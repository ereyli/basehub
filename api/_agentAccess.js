import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

export const AGENT_ACCESS_TABLE = 'agent_subscriptions'
export const EARLY_ACCESS_CONTRACT = '0x2f2b186B666Dd58D80e0b062A65F6EBd43a3CEC1'
export const AGENT_ACCESS_PRICE_USDC = '15'
export const AGENT_ACCESS_PASS_PRICE_USDC = '10.5'

const EARLY_ACCESS_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

export function normalizeAddress(address) {
  const value = String(address || '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(value) ? value : ''
}

export function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function getAgentAccessPrice(isPassHolder = false) {
  return isPassHolder ? AGENT_ACCESS_PASS_PRICE_USDC : AGENT_ACCESS_PRICE_USDC
}

export async function isEarlyAccessPassHolder(walletAddress) {
  const owner = normalizeAddress(walletAddress)
  if (!owner) return false

  const rpcUrl =
    process.env.BASE_RPC_URL ||
    process.env.VITE_AGENT_MODE_RPC_URL ||
    process.env.VITE_BASE_RPC_URL ||
    'https://mainnet.base.org'

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    })
    const balance = await client.readContract({
      address: EARLY_ACCESS_CONTRACT,
      abi: EARLY_ACCESS_ABI,
      functionName: 'balanceOf',
      args: [owner],
    })
    return BigInt(balance || 0) > 0n
  } catch (error) {
    console.warn('[Agent Access] Early Access Pass check failed:', error?.message || error)
    return false
  }
}

export async function getAgentAccess(walletAddress) {
  const payer = normalizeAddress(walletAddress)
  const passHolder = await isEarlyAccessPassHolder(payer)
  const priceUsdc = getAgentAccessPrice(passHolder)
  const supabase = getServerSupabase()

  if (!payer) {
    return {
      configured: Boolean(supabase),
      hasAccess: false,
      isPassHolder: passHolder,
      priceUsdc,
      subscription: null,
      setupError: null,
    }
  }

  if (!supabase) {
    return {
      configured: false,
      hasAccess: false,
      isPassHolder: passHolder,
      priceUsdc,
      subscription: null,
      setupError: 'Agent access storage is not configured.',
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(AGENT_ACCESS_TABLE)
    .select('*')
    .eq('payer_wallet_address', payer)
    .eq('entitlement', 'agent_mode_access')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return {
    configured: true,
    hasAccess: Boolean(data),
    isPassHolder: passHolder,
    priceUsdc,
    subscription: data || null,
    setupError: null,
  }
}

export async function grantAgentAccess({
  walletAddress,
  agentWalletAddress = null,
  priceLabel,
  network = 'base',
  paymentTxHash = null,
  discountReason = null,
}) {
  const payer = normalizeAddress(walletAddress)
  const agent = normalizeAddress(agentWalletAddress) || null
  const supabase = getServerSupabase()

  if (!payer) throw new Error('Valid walletAddress is required.')
  if (!supabase) throw new Error('Agent access storage is not configured.')

  const payload = {
    payer_wallet_address: payer,
    agent_wallet_address: agent,
    price_label: priceLabel,
    network,
    entitlement: 'agent_mode_access',
    payment_tx_hash: paymentTxHash,
    discount_reason: discountReason,
    access_type: 'one_time',
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase
    .from(AGENT_ACCESS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error && /discount_reason|access_type|updated_at/i.test(error.message || '')) {
    const legacyPayload = {
      payer_wallet_address: payer,
      agent_wallet_address: agent,
      price_label: priceLabel,
      network,
      entitlement: 'agent_mode_access',
      payment_tx_hash: paymentTxHash,
    }
    const legacyResult = await supabase
      .from(AGENT_ACCESS_TABLE)
      .insert(legacyPayload)
      .select('*')
      .single()
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) throw new Error(error.message)
  return data
}
