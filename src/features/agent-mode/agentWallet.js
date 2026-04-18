import { createPublicClient, createWalletClient, formatEther, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { AGENT_RPC_URL } from './agentConstants'

export function createBurnerWallet() {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return {
    address: account.address,
    privateKey,
    createdAt: new Date().toISOString(),
  }
}

export function getBurnerClients(privateKey) {
  const account = privateKeyToAccount(privateKey)
  const transport = http(AGENT_RPC_URL)
  return {
    account,
    publicClient: createPublicClient({ chain: base, transport }),
    walletClient: createWalletClient({ account, chain: base, transport }),
  }
}

export async function getBurnerBalance(address) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(AGENT_RPC_URL),
  })
  const balance = await publicClient.getBalance({ address })
  return {
    raw: balance,
    formatted: formatEther(balance),
  }
}

export function maskPrivateKey(privateKey) {
  if (!privateKey) return ''
  return `${privateKey.slice(0, 8)}...${privateKey.slice(-6)}`
}
