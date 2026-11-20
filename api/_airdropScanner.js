import { decodeEventLog, encodeFunctionData } from 'viem'
import {
  ADDRESS, HASH, ZERO, BRIDGE, FACTORY, IDENTITY, USDC, SPIKO, APPS, DEX, LENDING,
  B20_CANDIDATE, B20_ABI, B20_CREATED, B20_LAUNCHED, B20_CURVE_CREATED, B20_LAUNCHERS, TOKEN_CALLS, X402_PROXIES,
  X402_AUTH_CALLS, AUTH_USED, SETTLEMENTS, SWAP_EVENTS, SUPPLY_EVENTS, LENDING_EVENTS, LP_EVENTS,
  LP_MANAGERS, BRIDGE_EVENTS, AGENT_REGISTERED, USER_OP, USER_OP_ABI, ENTRY_POINTS, getStockRegistry,
} from './_airdropRegistry.js'
import { MODEL_VERSION, buildHistory, buildScore } from '../src/features/airdrop/model.js'

const WEEK = 7 * 86_400_000
const MIN_DATE = '2023-08-09'
const ERC_TOKENS = ['erc20', 'erc721', 'erc1155']
const MAX_RECEIPTS = 400
const lower = (value) => typeof value === 'string' ? value.toLowerCase() : ''
const hex = (number) => `0x${number.toString(16)}`
const padded = (address) => `0x${address.slice(2).padStart(64, '0')}`
const topicAddress = (topic) => /^0x0{24}[a-f\d]{40}$/.test(topic ?? '') ? `0x${topic.slice(-40)}` : ''
const tokenAddress = (transfer) => lower(transfer.rawContract?.address)
const amount = (transfer) => Number.isFinite(transfer.value) && transfer.value > 0 ? transfer.value : 0
const succeeded = (receipt) => receipt?.status === '0x1'
const txTime = (transfer) => Date.parse(transfer.metadata?.blockTimestamp ?? '')

export function parseCutoff(value, now = Date.now()) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < MIN_DATE) return undefined
  const start = Date.parse(value)
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== value || start > now) return undefined
  return Math.floor((start + 86_400_000 - 1) / 1000)
}

export function createRpc(url, fetcher = fetch, deadline) {
  let nextId = 0
  async function post(body) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timeout = AbortSignal.timeout(6500)
      const response = await fetcher(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: deadline ? AbortSignal.any([timeout, deadline]) : timeout,
      })
      if ([429, 502, 503, 504].includes(response.status) && attempt === 0 && !deadline?.aborted) {
        const retryAfter = Number(response.headers.get('retry-after'))
        await new Promise((resolve) => setTimeout(resolve, Math.min(2000, Math.max(700, retryAfter * 1000 || 0))))
        continue
      }
      if (!response.ok) throw new Error('Base data provider unavailable')
      return response.json()
    }
  }
  return {
    async call(method, ...params) {
      const id = ++nextId
      const reply = await post({ jsonrpc: '2.0', id, method, params })
      if (reply?.id !== id || reply.error || !('result' in reply)) throw new Error('Base RPC read failed')
      return reply.result
    },
    async batch(calls) {
      if (!calls.length) return []
      const messages = calls.map(([method, ...params]) => ({ jsonrpc: '2.0', id: ++nextId, method, params }))
      try {
        const reply = await post(messages)
        if (!Array.isArray(reply)) return calls.map(() => null)
        const byId = new Map(reply.map((message) => [message.id, message]))
        return messages.map(({ id }) => byId.get(id)?.result ?? null)
      } catch {
        return calls.map(() => null)
      }
    },
  }
}

export function createScanRpc(index, chain, backup) {
  // Transfer queries are expensive. Stagger them so one scan does not send
  // every indexed query in the same provider rate-limit window.
  let nextIndexRequest = Promise.resolve()
  return {
    async call(method, ...params) {
      if (method === 'alchemy_getAssetTransfers') {
        const job = nextIndexRequest.then(() => index.call(method, ...params))
        nextIndexRequest = job.catch(() => {}).then(() => new Promise((resolve) => setTimeout(resolve, 300)))
        return job
      }
      try {
        const value = await chain.call(method, ...params)
        if (value != null) return value
      } catch {
        // The backup can still resolve the pinned Base block.
      }
      return backup.call(method, ...params)
    },
    async batch(calls) {
      const results = await chain.batch(calls)
      const missing = calls.flatMap((call, index) => results[index] == null ? [index] : [])
      if (!missing.length) return results
      const fallback = await backup.batch(missing.map((index) => calls[index]))
      missing.forEach((index, offset) => { results[index] = fallback[offset] })
      return results
    },
  }
}

async function findBlock(rpc, cutoff) {
  const head = await rpc.call('eth_getBlockByNumber', 'safe', false)
  if (head?.number == null || head.timestamp == null) throw new Error('Unable to pin Base block')
  if (cutoff == null || Number(head.timestamp) <= cutoff) return head
  // Base uses approximately two-second blocks. Check the estimate, then verify
  // the upper boundary by searching block timestamps.
  let low = 0
  let high = Number(head.number)
  let best = null
  let guess = Math.max(0, high - Math.ceil((Number(head.timestamp) - cutoff) / 2))
  while (low <= high) {
    const block = await rpc.call('eth_getBlockByNumber', hex(guess), false)
    if (block?.timestamp == null) throw new Error('Historical Base block unavailable')
    if (Number(block.timestamp) <= cutoff) {
      best = block
      low = guess + 1
    } else {
      high = guess - 1
    }
    if (best && cutoff - Number(best.timestamp) <= 1 && low <= high) {
      const next = await rpc.call('eth_getBlockByNumber', hex(low), false)
      if (Number(next?.timestamp) > cutoff) return best
    }
    guess = Math.floor((low + high) / 2)
  }
  if (!best) throw new Error('Historical Base block unavailable')
  return best
}

async function collect(rpc, query, pages, size) {
  const rows = []
  let pageKey
  for (let page = 0; page < pages; page += 1) {
    try {
      const reply = await rpc.call('alchemy_getAssetTransfers', {
        fromBlock: '0x0', order: 'desc', withMetadata: true, maxCount: hex(size),
        ...query, ...(pageKey ? { pageKey } : {}),
      })
      if (!Array.isArray(reply?.transfers)) throw new Error('Transfers unavailable')
      rows.push(...reply.transfers)
      if (!reply.pageKey) return { rows, state: 'complete' }
      if (pageKey === reply.pageKey) break
      pageKey = reply.pageKey
    } catch {
      return { rows, state: rows.length ? 'partial' : 'unavailable' }
    }
  }
  return { rows, state: 'partial' }
}

function readOps(logs, walletTopic) {
  return logs.flatMap((log) => {
    if (!ENTRY_POINTS.has(lower(log.address)) || log.topics[0] !== USER_OP || log.topics[2] !== walletTopic) return []
    try {
      return [decodeEventLog({ abi: USER_OP_ABI, data: log.data, topics: log.topics }).args]
    } catch {
      return []
    }
  }).filter(({ success }) => success)
}

function isBridge(log, walletTopic) {
  if (lower(log.address) !== BRIDGE || !BRIDGE_EVENTS.has(log.topics[0])) return false
  // ETH indexes the recipient; ERC20 indexes both assets and the sender.
  return log.topics.length === 3
    ? log.topics[2] === walletTopic
    : `0x${log.data.slice(2, 66)}` === walletTopic
}

export function classifyWallet({ address, records, verifiedB20, stocks, cutoffTime, ethBalance, coverage, merchants }) {
  const walletTopic = padded(address)
  const evidence = new Map()
  const activeTimes = []
  const monthlyActivity = new Map()
  const appTimes = []
  const destinationTimes = new Map()
  const recentTargets = new Set()
  const apps = new Set()
  const swapAssets = new Set()
  const b20Assets = new Set()
  const defi = new Set()
  const labels = { x402: 'x402 payment', rwa: 'RWA action', b20: 'B20 action', received: 'Passive RWA receipt', bridge: 'Base bridge deposit', wallet: 'Sponsored smart account', build: 'Builder action', defi: 'DeFi action' }
  const counts = { transactions: 0, recentTransactions: 0, swaps: 0, deFiSupplies: 0, nftMints: 0, bridge: 0, x402: 0, rwaActions: 0, deployments: 0, agentRegistrations: 0, sponsored: 0, usdcVolume: 0 }
  function mark(group, hash, time, detail) {
    if (!evidence.has(group)) evidence.set(group, new Map())
    const entries = evidence.get(group)
    if (!entries.has(hash)) entries.set(hash, { hash, timestamp: new Date(time).toISOString(), label: labels[group], detail })
  }

  for (const { hash, time, tx, receipt, transfers } of records) {
    if (!succeeded(receipt) || !Number.isFinite(time) || time > cutoffTime) continue
    const logs = receipt.logs
    const to = lower(tx?.to)
    const own = lower(tx?.from) === address && Number(tx?.type) !== 126
    const ops = readOps(logs, walletTopic)
    const walletAction = own || ops.length > 0
    const recent = time > cutoffTime - 180 * 86_400_000
    const input = lower(tx?.input)
    const selector = input.slice(0, 10)
    const nativeAction = own && Boolean(to) && input.length >= 10 && !TOKEN_CALLS.has(selector)
    const outbound = transfers.filter((row) => lower(row.from) === address && lower(row.to) !== address)
    const incoming = transfers.filter((row) => lower(row.to) === address && lower(row.from) !== address)
    const paid = outbound.filter((row) => row.category === 'erc20' && amount(row) > 0)
    const received = incoming.filter((row) => row.category === 'erc20' && amount(row) > 0)
    const paidUsdc = paid.filter((row) => tokenAddress(row) === USDC)
    const knownAuthorizedPayment = to === USDC && X402_AUTH_CALLS.has(selector)
      && logs.some((log) => lower(log.address) === USDC && log.topics[0] === AUTH_USED && log.topics[1] === walletTopic)
      && paidUsdc.some((row) => merchants.has(lower(row.to)))
    const proxyPayment = X402_PROXIES.has(to) && paid.length > 0
      && logs.some((log) => lower(log.address) === to && SETTLEMENTS.has(log.topics[0]))
    if (knownAuthorizedPayment || proxyPayment) {
      counts.x402 += 1
      apps.add('x402')
      mark('x402', hash, time, knownAuthorizedPayment ? 'USDC authorization to a tracked BaseHub merchant' : 'x402 settlement contract and outgoing token transfer')
    }
    if (walletAction || knownAuthorizedPayment || proxyPayment) {
      const actions = Math.max(1, ops.length)
      counts.transactions += actions
      activeTimes.push(time)
      const month = new Date(time).toISOString().slice(0, 7)
      monthlyActivity.set(month, (monthlyActivity.get(month) ?? 0) + actions)
      if (recent) counts.recentTransactions += actions
    }
    const sponsored = ops.filter((op) => lower(op.paymaster) !== ZERO).length
    if (sponsored) {
      counts.sponsored += sponsored
      mark('wallet', hash, time, `${sponsored} successful paymaster operation(s)`)
    }
    // Ignore token destinations proven by their standard transfer logs or selectors.
    const tokenDestination = verifiedB20.has(to) || to === USDC || logs.some((log) =>
      lower(log.address) === to && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')
    if (nativeAction && !tokenDestination) {
      const range = destinationTimes.get(to) ?? [time, time]
      destinationTimes.set(to, [Math.min(range[0], time), Math.max(range[1], time)])
      if (recent) recentTargets.add(to)
    }
    const swapped = own && DEX.has(to) && logs.some((log) => SWAP_EVENTS.has(log.topics[0]))
    const lending = own && LENDING.has(to) && logs.some((log) => lower(log.address) === to && LENDING_EVENTS.has(log.topics[0]))
    const supplied = lending && logs.some((log) => lower(log.address) === to && SUPPLY_EVENTS.has(log.topics[0]))
    const liquidity = own && (LP_MANAGERS.has(to) || DEX.has(to)) && logs.some((log) => LP_EVENTS.has(log.topics[0]))
    if ((nativeAction && APPS.has(to)) || liquidity || knownAuthorizedPayment || proxyPayment) {
      appTimes.push(time)
      if (APPS.has(to)) apps.add(APPS.get(to))
    }
    if (swapped) {
      counts.swaps += 1
      for (const row of [...paid, ...received]) {
        const token = tokenAddress(row)
        if (ADDRESS.test(token)) swapAssets.add(token)
      }
      const directionalUsdc = (rows) => rows.filter((row) => tokenAddress(row) === USDC).reduce((sum, row) => sum + amount(row), 0)
      counts.usdcVolume += Math.abs(directionalUsdc(paid) - directionalUsdc(received))
    }
    if (lending || liquidity) {
      if (lending) defi.add('Lending')
      if (liquidity) defi.add('Liquidity')
      if (liquidity || supplied) counts.deFiSupplies += 1
      mark('defi', hash, time, liquidity ? 'Liquidity added on a tracked route' : supplied ? 'Assets supplied on a tracked lending protocol' : 'Tracked lending action')
    }
    if (logs.some((log) => isBridge(log, walletTopic))) {
      counts.bridge += 1
      mark('bridge', hash, time, 'Standard bridge finalized for this recipient')
    }
    if (own && incoming.some((row) => ['erc721', 'erc1155'].includes(row.category) && lower(row.from) === ZERO)) counts.nftMints += 1
    if (own && ADDRESS.test(receipt.contractAddress ?? '')) {
      counts.deployments += 1
      mark('build', hash, time, 'Direct contract creation')
    }
    if (logs.some((log) => lower(log.address) === IDENTITY && log.topics[0] === AGENT_REGISTERED && log.topics[2] === walletTopic)) {
      counts.agentRegistrations += 1
      mark('build', hash, time, 'ERC-8004 identity registered to this wallet')
    }

    for (const log of logs) {
      const emitter = lower(log.address)
      let created = ''
      if (own && to === FACTORY && emitter === FACTORY && log.topics[0] === B20_CREATED) created = topicAddress(log.topics[1])
      if (B20_LAUNCHERS.has(emitter)) {
        if (log.topics[0] === B20_LAUNCHED && log.topics[1] === walletTopic) created = topicAddress(log.topics[2])
        if (log.topics[0] === B20_CURVE_CREATED && log.topics[2] === walletTopic) created = topicAddress(log.topics[1])
      }
      if (B20_CANDIDATE.test(created)) {
        b20Assets.add(created)
        mark('b20', hash, time, 'Native B20 launch')
      }
    }

    const rwaNames = new Set()
    const b20Touched = new Set()
    for (const row of [...paid, ...received]) {
      const token = tokenAddress(row)
      const name = stocks.get(token) ?? SPIKO.get(token)
      const active = lower(row.from) === address || (walletAction && (swapped || supplied || liquidity || to === token || lower(row.from) === ZERO))
      if (name && active) rwaNames.add(name)
      if (name && !active) mark('received', hash, time, name)
      if (verifiedB20.has(token) && active) {
        b20Assets.add(token)
        b20Touched.add(name ?? `${token.slice(0, 8)}…${token.slice(-4)}`)
      }
    }
    if (nativeAction && verifiedB20.has(to)) {
      b20Assets.add(to)
      b20Touched.add(stocks.get(to) ?? `${to.slice(0, 8)}…${to.slice(-4)}`)
    }
    if (rwaNames.size) {
      counts.rwaActions += 1
      const kind = swapped ? 'Trade' : supplied ? 'Lending supply' : liquidity ? 'Liquidity' : paid.some((row) => stocks.has(tokenAddress(row)) || SPIKO.has(tokenAddress(row))) ? 'Sent / used' : 'Wallet-initiated receipt'
      mark('rwa', hash, time, `${kind} · ${[...rwaNames].join(', ')}`)
    }
    if (b20Touched.size) mark('b20', hash, time, [...b20Touched].join(', '))
  }

  const first = activeTimes.length ? Math.min(...activeTimes) : null
  const last = activeTimes.length ? Math.max(...activeTimes) : null
  const weekFor = (time) => Math.floor((time - first) / WEEK)
  const recentWeekCounts = new Map()
  for (const time of appTimes.filter((time) => time > cutoffTime - 180 * 86_400_000)) {
    const week = Math.floor((time - (cutoffTime - 180 * 86_400_000)) / WEEK)
    recentWeekCounts.set(week, (recentWeekCounts.get(week) ?? 0) + 1)
  }
  const metrics = {
    ...counts, ethBalance,
    contracts: destinationTimes.size, knownApps: apps.size,
    matureContracts: [...destinationTimes.values()].filter(([start, end]) => end - start >= 30 * 86_400_000).length,
    recentContracts: recentTargets.size,
    recentContractRatio: counts.recentTransactions ? 100 * recentTargets.size / counts.recentTransactions : 0,
    recentBusyWeeks: [...recentWeekCounts.values()].filter((count) => count >= 10).length,
    firstActivity: first == null ? null : new Date(first).toISOString(),
    lastActivity: last == null ? null : new Date(last).toISOString(),
    activitySpanHours: first == null ? 0 : (last - first) / 3_600_000,
    months: new Set(activeTimes.map((time) => new Date(time).toISOString().slice(0, 7))).size,
    weeks: new Set(activeTimes.map(weekFor)).size,
    appWeeks: new Set(appTimes.map(weekFor)).size,
    b20Assets: b20Assets.size, swappedAssets: swapAssets.size, defiTypes: defi.size,
  }
  const score = buildScore(metrics)
  if (!coverage.activityComplete && !score.total && !metrics.transactions) score.total = null
  const history = buildHistory(metrics, coverage)
  if (coverage.historyUnavailable) {
    for (const rule of history) {
      for (const criterion of rule.criteria) {
        if (criterion.status === 'unknown') criterion.measured = 'Unavailable'
      }
    }
  }
  return {
    metrics,
    monthlyActivity: [...monthlyActivity].sort(([a], [b]) => a.localeCompare(b)).map(([month, actions]) => ({ month, actions })),
    score,
    history,
    evidence: Object.fromEntries([...evidence].map(([group, items]) => [group,
      [...items.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8)])),
  }
}

export async function scanWallet(rpc, address, cutoff, fetcher = fetch) {
  const stockPromise = getStockRegistry(fetcher)
  const head = await findBlock(rpc, cutoff)
  const toBlock = head.number
  const cutoffTime = Number(head.timestamp) * 1000
  const merchants = new Set(['0x7d2ceb7a0e0c39a3d0f7b5b491659fde4bb7bcfe', lower(process.env.X402_RECEIVING_ADDRESS)]
    .filter((value) => ADDRESS.test(value) && value !== ZERO && value !== address))
  const [outgoing, sent, received, bridge, balances, registry, merchantTransfers] = await Promise.all([
    collect(rpc, { fromAddress: address, toBlock, category: ['external'], excludeZeroValue: false }, 3, 100),
    collect(rpc, { fromAddress: address, toBlock, category: ERC_TOKENS, excludeZeroValue: true }, 3, 200),
    collect(rpc, { toAddress: address, toBlock, category: ERC_TOKENS, excludeZeroValue: true }, 2, 200),
    collect(rpc, { fromAddress: BRIDGE, toAddress: address, toBlock, category: ['internal'], excludeZeroValue: true }, 1, 100),
    rpc.batch([['eth_getBalance', address, toBlock], ['eth_getCode', address, toBlock], ['eth_getTransactionCount', address, toBlock]]),
    stockPromise,
    Promise.all([...merchants].map((merchant) => collect(rpc, {
      fromAddress: address, toAddress: merchant, toBlock, category: ['erc20'], contractAddresses: [USDC], excludeZeroValue: true,
    }, 1, 20))),
  ])
  const candidates = new Map()
  const outgoingHashes = new Set(outgoing.rows.map(({ hash }) => lower(hash)).filter((hash) => HASH.test(hash)))
  const indexedTokens = new Set()
  for (const row of [...outgoing.rows, ...sent.rows, ...received.rows, ...bridge.rows, ...merchantTransfers.flatMap(({ rows }) => rows)]) {
    const hash = lower(row.hash)
    const time = txTime(row)
    if (!HASH.test(hash) || !Number.isFinite(time) || time > cutoffTime) continue
    const candidate = candidates.get(hash) ?? { hash, time, rows: new Map(), rank: 0 }
    candidate.rows.set(row.uniqueId ?? `${row.category}:${tokenAddress(row)}:${row.from}:${row.to}`, row)
    const token = tokenAddress(row)
    if (B20_CANDIDATE.test(token)) indexedTokens.add(token)
    if (row.category === 'external' && B20_CANDIDATE.test(lower(row.to))) indexedTokens.add(lower(row.to))
    const special = registry.stocks.has(token) || SPIKO.has(token) || B20_CANDIDATE.test(token)
    const merchantPayment = token === USDC && lower(row.from) === address && merchants.has(lower(row.to))
    const rank = merchantPayment ? 5 : special || row.category === 'internal' ? 4
      : outgoingHashes.has(hash) ? 3 : token === USDC && lower(row.from) === address ? 2 : 1
    candidate.rank = Math.max(candidate.rank, rank)
    candidates.set(hash, candidate)
  }
  const selected = [...candidates.values()].sort((a, b) => b.rank - a.rank || b.time - a.time).slice(0, MAX_RECEIPTS)
  const toVerify = [...indexedTokens].slice(0, 100)
  const records = []
  const verifiedB20 = new Set()
  let checkedB20 = 0
  const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))
  const groups = chunk(selected, 12)
  await Promise.all([
    (async () => {
      for (const batch of chunk(groups, 2)) {
        const hydrated = await Promise.all(batch.map(async (group) => {
          const calls = group.flatMap(({ hash }) => [['eth_getTransactionByHash', hash], ['eth_getTransactionReceipt', hash]])
          const replies = await rpc.batch(calls)
          const missing = calls.map((_, index) => index).filter((index) => replies[index] == null)
          if (missing.length) {
            const retry = await rpc.batch(missing.map((index) => calls[index]))
            missing.forEach((index, offset) => { replies[index] = retry[offset] })
          }
          return group.map((entry, index) => ({
            hash: entry.hash, time: entry.time, tx: replies[index * 2], receipt: replies[index * 2 + 1], transfers: [...entry.rows.values()],
          }))
        }))
        records.push(...hydrated.flat())
      }
    })(),
    (async () => {
      const calls = toVerify.map((token) => ['eth_call', {
        to: FACTORY, data: encodeFunctionData({ abi: B20_ABI, functionName: 'isB20Initialized', args: [token] }),
      }, toBlock])
      const results = (await Promise.all(chunk(calls, 20).map((batch) => rpc.batch(batch)))).flat()
      for (let i = 0; i < results.length; i += 1) {
        if (/^0x[\da-f]{64}$/i.test(results[i] ?? '')) {
          checkedB20 += 1
          if (BigInt(results[i]) === 1n) verifiedB20.add(toVerify[i])
        }
      }
    })(),
  ])
  const checked = records.filter(({ tx, receipt }) => tx && Array.isArray(receipt?.logs))
  const nonce = balances[2] == null ? null : Number(balances[2])
  const activityComplete = balances[1] === '0x' && nonce === outgoingHashes.size &&
    outgoing.state === 'complete' && sent.state === 'complete' && received.state === 'complete' &&
    checked.length === candidates.size
  const coverage = {
    activityComplete, receiptCount: checked.length, candidateCount: candidates.size, scanLimit: MAX_RECEIPTS,
    external: outgoing.state, sent: sent.state, received: received.state, bridge: bridge.state,
    stockRegistry: registry.complete ? 'complete' : 'partial',
    b20Registry: checkedB20 === indexedTokens.size ? 'complete' : 'partial',
    x402MerchantHistory: merchantTransfers.every(({ state }) => state === 'complete') ? 'complete' : 'partial',
    accountType: balances[1] == null ? 'unknown' : balances[1] === '0x' ? 'EOA'
      : /^0xef0100[\da-f]{40}$/i.test(balances[1]) ? 'Delegated EOA' : 'Smart account / contract',
  }
  const historyUnavailable = !checked.length && (!activityComplete || candidates.size > 0)
  coverage.historyUnavailable = historyUnavailable
  coverage.accountNonce = nonce
  const ethBalance = balances[0] == null ? null : Number(BigInt(balances[0])) / 1e18
  return {
    address, block: Number(toBlock), asOf: new Date(cutoffTime).toISOString(), version: MODEL_VERSION, coverage,
    ...classifyWallet({ address, records: checked, verifiedB20, stocks: registry.stocks, cutoffTime, ethBalance, coverage, merchants }),
  }
}
