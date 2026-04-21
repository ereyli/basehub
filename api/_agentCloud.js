import { createClient } from '@supabase/supabase-js'
import { encryptAgentSignerPrivateKey } from './_agentSignerCrypto.js'

const CLOUD_TABLE = 'agent_cloud_sessions'

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

function redactCloudSession(session) {
  if (!session) return null
  const policy = session.policy && typeof session.policy === 'object' ? { ...session.policy } : {}
  if (policy.agentSignerEncrypted) {
    policy.agentSignerEncrypted = { redacted: true, alg: policy.agentSignerEncrypted.alg || 'aes-256-gcm' }
  }
  return { ...session, policy }
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
  return { session: redactCloudSession(data), available: true, setupError: null }
}

export async function upsertCloudSession({
  ownerAddress,
  subAccountAddress,
  subAccount,
  spendPermission,
  allowanceEth,
  periodInDays,
  policy = {},
  agentSigner,
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

  const signerAddress = normalizeAddress(agentSigner?.address || policy?.agentSignerAddress)
  const encryptedSigner = agentSigner?.privateKey
    ? encryptAgentSignerPrivateKey(agentSigner.privateKey)
    : policy?.agentSignerEncrypted || null

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
      signerModel: encryptedSigner ? 'per_user_agent_signer' : (policy?.signerModel || 'shared_worker_signer'),
      agentSignerAddress: signerAddress || policy?.agentSignerAddress || null,
      agentSignerEncrypted: encryptedSigner || policy?.agentSignerEncrypted || null,
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
  return redactCloudSession(data)
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
  return redactCloudSession(data)
}
