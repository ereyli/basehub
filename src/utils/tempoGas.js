import { getAddress } from 'viem'

const TEMPO_GAS_CAP = 30_000_000n
const TEMPO_GAS_FLOOR = 12_000_000n
const TEMPO_GAS_DEFAULT = 28_000_000n

/**
 * Tempo: contract creation / heavy calls need much higher gas than Ethereum.
 * @param {import('viem').PublicClient} publicClient
 * @param {{ from: string, to: string, data: `0x${string}` | string, value?: bigint }} args
 */
export async function estimateTempoDeployTransactionGas(publicClient, { from, to, data, value = 0n }) {
  if (!publicClient || !from || !to || !data) return TEMPO_GAS_DEFAULT
  const dataHex = typeof data === 'string' && data.startsWith('0x') ? data : `0x${data}`
  try {
    const est = await publicClient.estimateGas({
      account: getAddress(from),
      to: getAddress(to),
      data: dataHex,
      value,
    })
    const buffered = (est * 130n) / 100n
    if (buffered > TEMPO_GAS_CAP) return TEMPO_GAS_CAP
    if (buffered < TEMPO_GAS_FLOOR) return TEMPO_GAS_FLOOR
    return buffered
  } catch (e) {
    console.warn('Tempo deploy gas estimate failed', e)
    return TEMPO_GAS_DEFAULT
  }
}
