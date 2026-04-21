import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, isAddress } from 'viem'
import { AGENT_RPC_URL } from '../src/features/agent-mode/agentConstants.js'

const CLOUD_TABLE = 'agent_cloud_sessions'
const BASE_ACCOUNT_OWNER_ABI = [
  {
    name: 'isOwnerAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
]

function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function normalizeAddress(address) {
  return String(address || '').trim().toLowerCase()
}

function getWorkerAddress() {
  return normalizeAddress(process.env.VITE_CLOUD_AGENT_SPENDER_ADDRESS || process.env.CLOUD_AGENT_SPENDER_ADDRESS)
}

async function checkWorkerOwnsSubAccount(subAccountAddress) {
  const normalizedSubAccount = normalizeAddress(subAccountAddress)
  const workerAddress = getWorkerAddress()
  if (!isAddress(normalizedSubAccount) || !isAddress(workerAddress)) return null

  try {
    const publicClient = createPublicClient({ transport: http(AGENT_RPC_URL) })
    const code = await publicClient.getCode({ address: normalizedSubAccount })
    if (!code || code === '0x') return null
    return await publicClient.readContract({
      address: normalizedSubAccount,
      abi: BASE_ACCOUNT_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [workerAddress],
    })
  } catch {
    return null
  }
}

function redactCloudSession(session) {
  if (!session) return null
  const policy = session.policy && typeof session.policy === 'object' ? { ...session.policy } : {}
  if (policy.agentSignerEncrypted) {
    policy.agentSignerEncrypted = { redacted: true, alg: policy.agentSignerEncrypted.alg || 'aes-256-gcm' }
  }
  return { ...session, policy }
}

async function decorateCloudSession(session) {
  const redacted = redactCloudSession(session)
  if (!redacted) return null
  return {
    ...redacted,
    worker_owns_sub_account: await checkWorkerOwnsSubAccount(redacted.sub_account_address),
  }
}

export async function getCloudSession(ownerAddress) {
  const supabase = getServerSupabase()
  const normalizedOwner = normalizeAddress(ownerAddress)
  if (!supabase || !normalizedOwner) {
    return {
      session: null,
      available: false,
      setupError: !supabase ? 'Supabase cloud agent storage is not configured.' : null,
    }
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .select('*')
    .eq('owner_address', normalizedOwner)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return { session: await decorateCloudSession(data), available: true, setupError: null }
}

export async function upsertCloudSession({
  ownerAddress,
  subAccountAddress,
  subAccount,
  spendPermission,
  allowanceEth,
  periodInDays,
  policy = {},
}) {
  const supabase = getServerSupabase()
  if (!supabase) {
    throw new Error('Supabase cloud agent storage is not configured.')
  }

  const normalizedOwner = normalizeAddress(ownerAddress)
  const normalizedSubAccount = normalizeAddress(subAccountAddress)
  if (!normalizedOwner || !normalizedSubAccount) {
    throw new Error('ownerAddress and subAccountAddress are required.')
  }

  const payload = {
    owner_address: normalizedOwner,
    sub_account_address: normalizedSubAccount,
    spender_address: normalizeAddress(spendPermission?.permission?.spender || spendPermission?.spender || policy?.spenderAddress),
    spend_permission: spendPermission || {},
    allowance_eth: String(allowanceEth || ''),
    period_days: Number(periodInDays || 1),
    policy: {
      ...(policy || {}),
      subAccount: subAccount || policy?.subAccount || null,
      signerModel: 'shared_worker_signer',
      agentSignerAddress: null,
      agentSignerEncrypted: null,
    },
    status: 'ready',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .upsert(payload, { onConflict: 'owner_address' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return decorateCloudSession(data)
}

export async function disableCloudSession(ownerAddress) {
  const supabase = getServerSupabase()
  const normalizedOwner = normalizeAddress(ownerAddress)
  if (!supabase || !normalizedOwner) return null

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .update({ status: 'disabled', updated_at: new Date().toISOString() })
    .eq('owner_address', normalizedOwner)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return decorateCloudSession(data)
}
