import assert from 'node:assert/strict'
import test from 'node:test'
import { AIRDROP_POOL, TOKEN_SUPPLY, buildHistory, estimateAllocation } from '../src/features/airdrop/model.js'
import { classifyWallet, createRpc, createScanRpc, parseCutoff, scanWallet } from '../api/_airdropScanner.js'
import { AUTH_USED, USDC, X402_AUTH_CALLS } from '../api/_airdropRegistry.js'
import handleAirdropScan from '../api/base-airdrop-check.js'

const wallet = '0x0000000000000000000000000000000000000001'
const merchant = '0x0000000000000000000000000000000000000002'
const stock = '0xb200000000000000000000c2e324d24d7eecd1fb'
const time = Date.parse('2026-11-01T00:00:00Z')

test('queues scans at capacity, shares pending results and serves cached repeats', async (t) => {
  const originalKey = process.env.ALCHEMY_API_KEY
  process.env.ALCHEMY_API_KEY = 'test-key'
  t.after(() => {
    if (originalKey === undefined) delete process.env.ALCHEMY_API_KEY
    else process.env.ALCHEMY_API_KEY = originalKey
  })

  let releaseHeads
  const holdHeads = new Promise((resolve) => { releaseHeads = resolve })
  let heads = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!options?.body) return Response.json({ tokens: [{ contract_address: stock, symbol: 'AAPLc' }] })
    const body = JSON.parse(options.body)
    if (Array.isArray(body)) {
      return Response.json(body.map(({ id, method }) => ({ id, result: method === 'eth_getCode' ? '0x' : '0x0' })))
    }
    if (body.method === 'eth_getBlockByNumber') {
      heads += 1
      await holdHeads
      return Response.json({ id: body.id, result: { number: '0x100000', timestamp: '0x69000000' } })
    }
    return Response.json({ id: body.id, result: { transfers: [] } })
  })

  async function request(id) {
    const address = `0x${id.toString(16).padStart(40, '0')}`
    const headers = new Map()
    return handleAirdropScan({ method: 'GET', url: `/api/base-airdrop-check?address=${address}` }, {
      setHeader: (name, value) => headers.set(name, value),
      status: (status) => ({ json: (body) => ({ status, headers, body }) }),
    })
  }

  const requests = Array.from({ length: 18 }, (_, index) => request(100 + index))
  const duplicate = request(117)
  let overloaded
  let initialHeads
  try {
    overloaded = await request(118)
    initialHeads = heads
  } finally {
    releaseHeads()
  }
  const results = await Promise.all(requests)
  assert.equal(initialHeads, 6)
  assert.equal(overloaded.status, 429)
  assert.equal(overloaded.headers.get('Retry-After'), '3')
  assert.ok(results.every(({ status }) => status === 200))
  assert.ok(results.every(({ headers }) => headers.has('Vercel-CDN-Cache-Control')))
  assert.equal(overloaded.headers.has('Vercel-CDN-Cache-Control'), false)
  assert.strictEqual((await duplicate).body, results.at(-1).body)
  assert.strictEqual((await request(117)).body, results.at(-1).body)
  assert.equal(heads, requests.length)
})

test('retries a throttled index response without using it as wallet data', async () => {
  let attempts = 0
  const provider = createRpc('https://index.example', async (url, { body }) => {
    const { id } = JSON.parse(body)
    attempts += 1
    return Response.json(attempts === 1 ? { id, error: { code: 429 } } : { id, result: { transfers: [] } })
  })
  assert.deepEqual(await provider.call('alchemy_getAssetTransfers', {}), { transfers: [] })
  assert.equal(attempts, 2)
})

test('reuses successful index pages only for the requested block and query', async () => {
  const pages = new Map()
  let calls = 0
  const index = { call: async () => { calls += 1; return { transfers: [] } } }
  const query = { fromAddress: wallet, toBlock: '0x100000' }
  await createScanRpc(index, null, null, pages).call('alchemy_getAssetTransfers', query)
  await createScanRpc(index, null, null, pages).call('alchemy_getAssetTransfers', query)
  assert.equal(calls, 1)
  await createScanRpc(index, null, null, pages).call('alchemy_getAssetTransfers', { ...query, toBlock: '0x100001' })
  assert.equal(calls, 2)
})

function transfer(from, to, token) {
  return { from, to, value: 1, category: 'erc20', rawContract: { address: token } }
}

function record(id, from, to, transfers, options = {}) {
  return {
    hash: `0x${id.toString(16).padStart(64, '0')}`, time: options.time ?? time,
    tx: { from, to, input: options.input ?? '0x' },
    receipt: { status: options.status ?? '0x1', logs: options.logs ?? [] }, transfers,
  }
}

function analyze(records, { complete = true, balance = 0.001 } = {}) {
  return classifyWallet({
    address: wallet, records, verifiedB20: new Set([stock]), stocks: new Map([[stock, 'AAPLc']]),
    cutoffTime: time, ethBalance: balance, coverage: { activityComplete: complete }, merchants: new Set([merchant]),
  })
}

test('uses the requested tokenomics with valid score-weighted populations', () => {
  assert.equal(AIRDROP_POOL / TOKEN_SUPPLY, 0.1)
  assert.equal(estimateAllocation(75, 2_000_000, 'weighted', 50), 750)
  assert.equal(estimateAllocation(75, 2_000_000, 'equal', 50), 500)
  assert.equal(estimateAllocation(75, 1, 'weighted', 50), null)
  assert.equal(estimateAllocation(75, 0, 'equal', 50), null)
})

test('uses a strict UTC date boundary and rejects invalid dates', () => {
  assert.equal(parseCutoff('2025-01-01'), Date.parse('2025-01-01T23:59:59Z') / 1000)
  assert.equal(parseCutoff('2025-02-30'), undefined)
  assert.equal(parseCutoff('2022-12-31'), undefined)
  assert.equal(parseCutoff('2025-01-01', Date.parse('2024-12-31')), undefined)
  assert.equal(parseCutoff(''), null)
})

test('does not score passive RWA receipts, failed calls or post-cutoff events', () => {
  const result = analyze([
    record(1, merchant, stock, [transfer(merchant, wallet, stock)]),
    record(2, wallet, stock, [transfer(wallet, merchant, stock)], { status: '0x0' }),
    record(3, wallet, stock, [transfer(wallet, merchant, stock)], { time: time + 1000 }),
  ])
  assert.equal(result.score.total, 0)
  assert.equal(result.evidence.received.length, 1)
  assert.equal(result.metrics.rwaActions, 0)
  assert.equal(result.metrics.b20Assets, 0)
})

test('scores a wallet-authored B20 movement without doubling activity per transfer leg', () => {
  const result = analyze([record(1, wallet, stock, [transfer(wallet, merchant, stock), transfer(wallet, merchant, stock)])])
  assert.equal(result.metrics.transactions, 1)
  assert.equal(result.metrics.rwaActions, 1)
  assert.equal(result.metrics.b20Assets, 1)
  assert.deepEqual(result.monthlyActivity, [{ month: '2026-11', actions: 1 }])
})

test('keeps indexed requests isolated and fills missing chain results through the backup', async () => {
  const index = {
    call: async () => ({ transfers: [] }),
    batch: async (calls) => {
      assert.deepEqual(calls, [['transaction'], ['receipt']])
      return ['verified transaction', null]
    },
  }
  const chain = { call: async () => { throw new Error('Primary rate limited') }, batch: async () => ['0x2', null, null] }
  const backup = { call: async () => 'safe block', batch: async (calls) => {
    assert.deepEqual(calls, [['receipt']])
    return ['verified receipt']
  } }
  const rpc = createScanRpc(index, chain, backup)
  assert.equal(await rpc.call('eth_getBlockByNumber', 'safe'), 'safe block')
  assert.deepEqual(await rpc.call('alchemy_getAssetTransfers', {}), { transfers: [] })
  assert.deepEqual(await rpc.batch([['nonce'], ['transaction'], ['receipt']]), ['0x2', 'verified transaction', 'verified receipt'])
})

test('reports a verified nonce and withholds the score when indexed history is unavailable', async () => {
  const rpc = {
    call: async (method) => {
      if (method === 'eth_getBlockByNumber') return { number: '0x100000', timestamp: '0x69000000' }
      throw new Error('Index rate limited')
    },
    batch: async () => ['0x0', '0x', '0x517'],
  }
  const result = await scanWallet(rpc, wallet, null, async () => Response.json({
    tokens: [{ contract_address: stock, symbol: 'AAPLc' }],
  }))
  assert.equal(result.coverage.accountNonce, 1303)
  assert.equal(result.coverage.historyUnavailable, true)
  assert.equal(result.score.total, null)
  assert.deepEqual(result.monthlyActivity, [])
})

test('hydrates indexed transactions in batches and retries only missing fields', async () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({
    hash: `0x${index.toString(16).padStart(64, '0')}`,
    metadata: { blockTimestamp: new Date(time + index * 1000).toISOString() },
    category: 'external', from: wallet, to: merchant,
  }))
  const missingHash = rows.at(-1).hash
  const blockHash = `0x${'1'.repeat(64)}`
  const reads = []
  let missingReceipt = true
  let keepReceiptMissing = false
  const rpc = {
    call: async (method, query) => {
      if (method === 'eth_getBlockByNumber') return { number: '0x100000', timestamp: `0x${(time / 1000 + 60).toString(16)}` }
      if (query.category[0] !== 'external') return { transfers: [] }
      assert.equal(query.maxCount, '0x12c')
      return { transfers: rows }
    },
    batch: async (calls) => {
      if (calls[0][0] === 'eth_getBalance') return ['0x0', '0x', '0x19']
      reads.push(calls)
      return calls.map(([method, hash]) => {
        if (method === 'eth_getTransactionByHash') return { hash, blockHash, from: wallet, to: merchant, input: '0x' }
        if (hash === missingHash && (missingReceipt || keepReceiptMissing)) {
          missingReceipt = false
          return null
        }
        return { transactionHash: hash, blockHash, blockNumber: '0x100000', status: '0x1', logs: [] }
      })
    },
  }
  const result = await scanWallet(rpc, wallet, null, async () => Response.json({
    tokens: [{ contract_address: stock, symbol: 'AAPLc' }],
  }))
  assert.deepEqual(reads.map((calls) => calls.length), [48, 2, 1])
  assert.deepEqual(reads.at(-1), [['eth_getTransactionReceipt', missingHash]])
  assert.equal(result.coverage.activityComplete, true)
  assert.equal(result.coverage.estimateReady, true)
  assert.equal(result.metrics.transactions, rows.length)

  keepReceiptMissing = true
  const degraded = await scanWallet(rpc, wallet, null)
  assert.equal(degraded.block, result.block)
  assert.equal(degraded.metrics.transactions, rows.length - 1)
  assert.equal(degraded.coverage.estimateReady, false)
  assert.equal(degraded.score.total, null)
  assert.equal(estimateAllocation(degraded.score.total, 2_000_000, 'weighted', 50), null)

  keepReceiptMissing = false
  rows.reverse()
  const finalized = new Map()
  const recovered = await scanWallet(rpc, wallet, null, undefined, finalized)
  assert.equal(recovered.coverage.estimateReady, true)
  assert.deepEqual(recovered.score, result.score)
  assert.equal(finalized.size, rows.length)
  reads.length = 0
  const cached = await scanWallet(rpc, wallet, null, undefined, finalized)
  assert.deepEqual(reads, [])
  assert.deepEqual(cached.score, result.score)
})

test('requires a supported authorization, payer and merchant for direct x402 attribution', () => {
  const authorization = { address: USDC, topics: [AUTH_USED, `0x${wallet.slice(2).padStart(64, '0')}`] }
  const payment = transfer(wallet, merchant, USDC)
  const result = analyze([
    record(1, wallet, USDC, [payment]),
    record(2, merchant, USDC, [payment], { input: [...X402_AUTH_CALLS][0], logs: [authorization] }),
    record(3, merchant, USDC, [payment], { input: [...X402_AUTH_CALLS][0] }),
  ])
  assert.equal(result.metrics.x402, 1)
  assert.equal(result.evidence.x402.length, 1)
})

test('distinguishes missing history from a failed threshold and gap-free ETH balance checks', () => {
  const partial = analyze([], { complete: false, balance: null })
  const stark = partial.history.find(({ id }) => id === 'stark')
  assert.equal(stark.status, 'unknown')
  assert.ok(stark.criteria.every(({ status }) => status === 'unknown'))
  assert.equal(analyze([]).history.find(({ id }) => id === 'stark').status, 'missed')
})

test('evaluates historical criteria independently at their original threshold boundaries', () => {
  const metrics = {
    ...analyze([]).metrics, transactions: 6, months: 3, usdcVolume: 100, ethBalance: 0.005,
    recentContracts: 20, recentContractRatio: 10, bridge: 1, deFiSupplies: 1, activitySpanHours: 72,
  }
  const result = buildHistory(metrics, { activityComplete: true })
  assert.equal(result.find(({ id }) => id === 'stark').status, 'met')
  assert.equal(result.find(({ id }) => id === 'op5').status, 'met')
  assert.equal(result.find(({ id }) => id === 'zk').status, 'met')
  const revised = buildHistory({ ...metrics, transactions: 5, recentContractRatio: 9.99 }, { activityComplete: true })
  assert.equal(revised.find(({ id }) => id === 'stark').status, 'missed')
  assert.equal(revised.find(({ id }) => id === 'op5').status, 'missed')
})
