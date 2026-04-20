import { createPublicClient, formatEther, http } from 'viem'
import { base } from 'viem/chains'
import { AGENT_RPC_URL } from './agentConstants'

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
