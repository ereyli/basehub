/**
 * Base app smart wallet sendCalls + Builder Code (ERC-8021).
 * Since Base app transactions go through batched tx (sendCalls), writeContract + dataSuffix
 * does not provide attribution; we need to pass capabilities.dataSuffix via sendCalls.
 */
import { encodeFunctionData } from 'viem'
import { sendCalls, waitForCallsStatus } from '@wagmi/core'
import { config, BUILDER_CODE_CAPABILITIES } from '../config/wagmi'
import { base } from 'wagmi/chains'

const BASE_CHAIN_ID = base.id

/**
 * Sends a single contract call via sendCalls + Builder Code in the Base app environment,
 * returns tx hash once confirmed. Use only for Base chain (8453).
 * @returns {Promise<`0x${string}` | null>} transactionHash of the first (or only) receipt, null on error/timeout
 */
export async function sendContractCallBaseApp({ address, abi, functionName, args = [], value = 0n }) {
  const chainId = BASE_CHAIN_ID
  const data = encodeFunctionData({ abi, functionName, args })
  try {
    const { id } = await sendCalls(config, {
      calls: [{ to: address, data, value }],
      chainId,
      capabilities: BUILDER_CODE_CAPABILITIES,
    })
    const result = await waitForCallsStatus(config, { id })
    const receipts = result?.receipts
    if (receipts?.length) {
      const first = receipts[0]
      return first?.transactionHash ?? null
    }
    return null
  } catch (err) {
    console.warn('Base app sendCalls failed:', err?.message ?? err)
    throw err
  }
}

/**
 * Checks if running in Base app on Base chain – sendCalls path should only be used in this case.
 */
export function shouldUseSendCallsForBaseApp(isBaseApp, chainId) {
  return Boolean(isBaseApp && chainId === BASE_CHAIN_ID)
}
