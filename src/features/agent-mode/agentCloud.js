import { parseEther } from 'viem'
import { base } from 'viem/chains'

const CLOUD_AGENT_STORAGE_KEY = 'basehub_cloud_agent_v1'
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

function getCloudApiBase() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function serializeForJson(value) {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(serializeForJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeForJson(item)]))
  }
  return value
}

export function loadCloudAgentState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CLOUD_AGENT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCloudAgentState(state) {
  if (typeof window === 'undefined') return null
  const nextState = {
    updatedAt: new Date().toISOString(),
    ...(state || {}),
  }
  window.localStorage.setItem(CLOUD_AGENT_STORAGE_KEY, JSON.stringify(nextState))
  return nextState
}

export function getCloudAgentSpenderAddress() {
  return String(import.meta.env.VITE_CLOUD_AGENT_SPENDER_ADDRESS || '').trim()
}

export async function createBaseAccountClient() {
  const { createBaseAccountSDK } = await import('@base-org/account')
  const sdk = createBaseAccountSDK({
    appName: 'BaseHub Cloud Agent',
    appLogoUrl: 'https://www.basehub.fun/logo.png',
    appChainIds: [base.id],
    subAccounts: {
      creation: 'manual',
      defaultAccount: 'universal',
      funding: 'spend-permissions',
    },
  })
  return { sdk, provider: sdk.getProvider() }
}

export async function createBaseAccountProvider() {
  const { provider } = await createBaseAccountClient()
  return provider
}

export async function connectBaseAccountDirect() {
  const { sdk, provider } = await createBaseAccountClient()
  const accounts = await provider.request({
    method: 'eth_requestAccounts',
    params: [],
  })
  const universalAddress = Array.isArray(accounts) ? accounts[0] : ''
  if (!universalAddress) {
    throw new Error('Base Account connection failed.')
  }

  const cloudState = saveCloudAgentState({
    mode: 'cloud',
    accountMode: 'direct_base_account',
    status: 'base_account_ready',
    universalAddress,
    accountAddress: universalAddress,
  })

  return { sdk, provider, universalAddress, accountAddress: universalAddress, cloudState }
}

export async function createDelegatedSubAccount({
  sdk,
  workerAddress,
}) {
  const automationOwner = String(workerAddress || getCloudAgentSpenderAddress()).trim()
  if (!automationOwner) {
    throw new Error('Cloud agent worker address is not configured.')
  }
  const baseSdk = sdk || (await createBaseAccountClient()).sdk
  const subAccount = await baseSdk.subAccount.create({
    type: 'create',
    keys: [
      {
        type: 'address',
        publicKey: automationOwner,
      },
    ],
  })
  if (!subAccount?.address) {
    throw new Error('Base Account did not return an agent sub-account.')
  }
  return serializeForJson(subAccount)
}

export async function requestNativeSpendPermission({
  account,
  allowanceEth = '0.0025',
  periodInDays = 1,
  spender,
  provider,
}) {
  const spenderAddress = String(spender || getCloudAgentSpenderAddress()).trim()
  if (!spenderAddress) {
    throw new Error('Cloud agent spender address is not configured.')
  }
  if (!account) {
    throw new Error('Base Account address is required.')
  }

  const baseProvider = provider || await createBaseAccountProvider()
  const { requestSpendPermission } = await import('@base-org/account/spend-permission')
  const permission = await requestSpendPermission({
    account,
    spender: spenderAddress,
    token: NATIVE_TOKEN_ADDRESS,
    chainId: base.id,
    allowance: parseEther(String(allowanceEth)),
    periodInDays: Number(periodInDays || 1),
    provider: baseProvider,
  })

  const serializedPermission = serializeForJson(permission)
  const nextState = saveCloudAgentState({
    ...(loadCloudAgentState() || {}),
    status: 'permission_ready',
    spender: spenderAddress,
    spendPermission: serializedPermission,
    allowanceEth: String(allowanceEth),
    periodInDays: Number(periodInDays || 1),
  })

  return { permission: serializedPermission, cloudState: nextState }
}

export async function requestMainAccountAutomationPermission({
  account,
  workerAddress,
}) {
  const automationOwner = String(workerAddress || getCloudAgentSpenderAddress()).trim()
  if (!automationOwner) {
    throw new Error('Cloud agent worker address is not configured.')
  }
  if (!account) {
    throw new Error('Base Account address is required.')
  }

  // Coinbase/Base Account currently rejects self-calls from the account to itself
  // ("Self calls are not allowed"). Adding an automation owner to the *main*
  // account would require exactly that self-call, so we stop before opening the
  // wallet popup and show a clear product-level explanation instead.
  throw new Error(
    'Direct main Base Account automation is blocked by Base Account self-call rules. Full automatic execution requires a delegated sub-account or dedicated agent account.'
  )
}

export async function registerCloudAgentSession({
  ownerAddress,
  subAccountAddress,
  subAccount,
  spendPermission,
  allowanceEth,
  periodInDays,
  policy,
}) {
  const res = await fetch(`${getCloudApiBase()}/api/agent-cloud`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'register',
      ownerAddress,
      subAccountAddress,
      subAccount,
      spendPermission,
      allowanceEth,
      periodInDays,
      policy,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Cloud Agent session could not be registered.')
  }
  const nextState = saveCloudAgentState({
    ...(loadCloudAgentState() || {}),
    status: 'cloud_ready',
    sessionId: data.session?.id || null,
    universalAddress: ownerAddress,
    accountAddress: ownerAddress,
    subAccount: subAccount || (subAccountAddress && subAccountAddress !== ownerAddress ? { address: subAccountAddress } : null),
    spendPermission: spendPermission || null,
    allowanceEth: String(allowanceEth || ''),
    periodInDays: Number(periodInDays || 1),
    accountMode: policy?.accountMode,
    executionMode: policy?.executionMode,
    permissionModel: policy?.permissionModel,
    automationOwner: policy?.automationOwner || policy?.spenderAddress,
    registeredAt: new Date().toISOString(),
  })
  return { ...data, cloudState: nextState }
}

export async function fetchCloudAgentSession(ownerAddress) {
  if (!ownerAddress) return null
  const res = await fetch(`${getCloudApiBase()}/api/agent-cloud?ownerAddress=${encodeURIComponent(ownerAddress)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Cloud Agent session could not be loaded.')
  }
  return data.session || null
}

export async function executeCloudAgentAction({
  ownerAddress,
  subAccount,
  action,
  settings = {},
  logs = [],
  spendPermission = null,
}) {
  const res = await fetch(`${getCloudApiBase()}/api/agent-cloud-execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerAddress,
      subAccount,
      action,
      settings,
      logs,
      spendPermission,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Cloud Agent execution failed.')
  }
  return data
}

export async function startCloudAgentRun({
  ownerAddress,
  subAccountAddress,
  subAccount,
  currentPlan,
  settings = {},
  logs = [],
  spendPermission = null,
  intervalMinutes,
}) {
  const res = await fetch(`${getCloudApiBase()}/api/agent-cloud-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'start',
      ownerAddress,
      subAccountAddress,
      subAccount,
      currentPlan,
      settings,
      logs,
      spendPermission,
      intervalMinutes,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Cloud Agent run could not be started.')
  }
  return data.run
}

export async function stopCloudAgentRun({ ownerAddress }) {
  const res = await fetch(`${getCloudApiBase()}/api/agent-cloud-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'stop',
      ownerAddress,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Cloud Agent run could not be stopped.')
  }
  return data.runs || []
}
