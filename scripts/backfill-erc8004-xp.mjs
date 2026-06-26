import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'

const REGISTRAR_ADDRESS = '0x125467368441F5a8c5C1184b09E5BE95f8b7aE3C'
const REGISTRAR_DEPLOY_BLOCK = 47670327n
const LOG_BLOCK_CHUNK_SIZE = 9500n
const XP_AMOUNT = 5000
const GAME_TYPE = 'ERC8004 Agent Registration'

const apply = process.argv.includes('--apply')
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org', {
    timeout: 12000,
    retryCount: 2,
    retryDelay: 800,
  }),
})

const agentRegisteredEvent = parseAbiItem(
  'event AgentRegistered(address indexed user, uint256 indexed agentId, string agentURI, uint256 feePaid)'
)

function normalizeAddress(address) {
  return String(address || '').trim().toLowerCase()
}

async function getRegistrarEvents() {
  const latestBlock = await publicClient.getBlockNumber()
  const registrations = []
  let fromBlock = REGISTRAR_DEPLOY_BLOCK

  while (fromBlock <= latestBlock) {
    const toBlock = fromBlock + LOG_BLOCK_CHUNK_SIZE > latestBlock
      ? latestBlock
      : fromBlock + LOG_BLOCK_CHUNK_SIZE
    const logs = await publicClient.getLogs({
      address: REGISTRAR_ADDRESS,
      event: agentRegisteredEvent,
      fromBlock,
      toBlock,
    })
    registrations.push(...logs.map((log) => ({
      wallet: normalizeAddress(log.args.user),
      agentId: log.args.agentId?.toString(),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber?.toString(),
    })))
    fromBlock = toBlock + 1n
  }

  return registrations
}

async function getExistingERC8004Wallets() {
  const wallets = new Set()
  for (const table of ['transactions', 'miniapp_transactions']) {
    const { data, error } = await supabase
      .from(table)
      .select('wallet_address')
      .eq('game_type', GAME_TYPE)
      .limit(10000)

    if (error) {
      console.warn(`Could not read ${table}: ${error.message}`)
      continue
    }
    for (const row of data || []) {
      const wallet = normalizeAddress(row.wallet_address)
      if (wallet) wallets.add(wallet)
    }
  }
  return wallets
}

async function awardXP(registration) {
  const { data, error } = await supabase.rpc('award_xp', {
    p_wallet_address: registration.wallet,
    p_final_xp: XP_AMOUNT,
    p_game_type: GAME_TYPE,
    p_transaction_hash: registration.txHash,
    p_source: 'web',
    p_chain_id: base.id,
  })

  if (error && /p_chain_id|function|schema cache/i.test(error.message || '')) {
    const retry = await supabase.rpc('award_xp', {
      p_wallet_address: registration.wallet,
      p_final_xp: XP_AMOUNT,
      p_game_type: GAME_TYPE,
      p_transaction_hash: registration.txHash,
      p_source: 'web',
    })
    if (retry.error) throw retry.error
    return retry.data
  }

  if (error) throw error
  return data
}

const registrations = await getRegistrarEvents()
const existingWallets = await getExistingERC8004Wallets()
const latestByWallet = new Map()

for (const registration of registrations) {
  if (!registration.wallet) continue
  latestByWallet.set(registration.wallet, registration)
}

const missing = [...latestByWallet.values()].filter((registration) => !existingWallets.has(registration.wallet))

console.log(`ERC-8004 registrar events: ${registrations.length}`)
console.log(`Unique wallets: ${latestByWallet.size}`)
console.log(`Wallets with ERC-8004 XP already: ${existingWallets.size}`)
console.log(`Missing ERC-8004 XP: ${missing.length}`)

if (!apply) {
  console.log('Dry run only. Re-run with --apply to award missing XP.')
  for (const item of missing.slice(0, 25)) {
    console.log(`${item.wallet} agentId=${item.agentId} tx=${item.txHash}`)
  }
  if (missing.length > 25) console.log(`...and ${missing.length - 25} more`)
  process.exit(0)
}

let awarded = 0
for (const registration of missing) {
  try {
    const result = await awardXP(registration)
    awarded += 1
    console.log(`Awarded ${XP_AMOUNT} XP to ${registration.wallet}: total=${result?.new_total_xp ?? 'unknown'}`)
  } catch (error) {
    console.error(`Failed ${registration.wallet} tx=${registration.txHash}: ${error.message || error}`)
  }
}

console.log(`Backfill complete. Awarded: ${awarded}/${missing.length}`)
