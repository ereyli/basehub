/**
 * Base app akıllı cüzdan sendCalls + Builder Code (ERC-8021).
 * Base app işlemleri toplu tx (sendCalls) ile gittiği için writeContract + dataSuffix
 * attribution sağlamıyor; sendCalls ile capabilities.dataSuffix geçmemiz gerekiyor.
 */
import { encodeFunctionData } from 'viem'
import { sendCalls, waitForCallsStatus } from '@wagmi/core'
import { config, BUILDER_CODE_CAPABILITIES } from '../config/wagmi'
import { base } from 'wagmi/chains'

const BASE_CHAIN_ID = base.id

/**
 * Base app ortamında tek bir contract çağrısını sendCalls + Builder Code ile gönderir,
 * onaylanınca tx hash döner. Sadece Base chain (8453) için kullanın.
 * @param {{ address: `0x${string}`, abi: readonly unknown[], functionName: string, args?: readonly unknown[], value?: bigint }} params
 * @returns {Promise<`0x${string}` | null>} İlk (veya tek) receipt'in transactionHash'i, hata/timeout'ta null
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
 * Base app'te mi ve Base chain'de mi kontrolü – sendCalls path sadece bu durumda kullanılmalı.
 */
export function shouldUseSendCallsForBaseApp(isBaseApp, chainId) {
  return Boolean(isBaseApp && chainId === BASE_CHAIN_ID)
}
