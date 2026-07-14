import { useCallback, useMemo, useState } from 'react'
import { useAccount, useChainId, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import {
  formatEther,
  formatUnits,
  keccak256,
  maxUint256,
  parseEther,
  parseEventLogs,
  parseUnits,
  stringToBytes,
} from 'viem'
import { config, DATA_SUFFIX } from '../config/wagmi'
import { NETWORKS } from '../config/networks'
import { addXP } from '../utils/xpUtils'
import { getReadClient } from '../utils/readClient'
import {
  B20_CURVE_CREATE_FEE_ETH,
  B20_CURVE_ERC20_ABI,
  B20_XP_GAME_TYPE,
  B20_XP_REWARD,
  BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
  getB20CurveLaunchpadAddress,
  isB20SupportedChainId,
  isB20TestnetChainId,
} from '../config/b20'

const RECEIPT_TIMEOUT_MS = 90000
const TOKEN_BATCH_SIZE = 40
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry(fn, { attempts = 3, delayMs = 600 } = {}) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < attempts - 1) await sleep(delayMs * (attempt + 1))
    }
  }
  throw lastError
}

function cleanName(value) {
  return String(value || '').trim().slice(0, 32)
}

function cleanSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
}

function cleanText(value, max = 240) {
  return String(value || '').trim().slice(0, max)
}

function cleanUrl(value) {
  return String(value || '').trim().slice(0, 300)
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeDecimalInput(value, decimals = 18) {
  let text = String(value ?? '').trim().replace(/\s/g, '')
  if (!text) return '0'

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandSeparator = decimalSeparator === ',' ? '.' : ','
    text = text.split(thousandSeparator).join('')
    text = text.replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    text = text.replace(',', '.')
  }

  text = text.replace(/[^\d.]/g, '')
  const [whole = '0', ...fractionParts] = text.split('.')
  const fraction = fractionParts.join('').slice(0, decimals)
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '') || '0'
  return fraction ? `${normalizedWhole}.${fraction}` : normalizedWhole
}

function getMaxCurveSellAmount(core, balance) {
  if (!core || core.graduated) return balance
  if (core.realETH <= 0n || core.virtualTokens <= 0n) return 0n
  if (core.virtualETH <= core.realETH) return balance

  const maxByLiquidity = (core.realETH * core.virtualTokens) / (core.virtualETH - core.realETH)
  const conservativeMax = (maxByLiquidity * 995n) / 1000n
  return conservativeMax < balance ? conservativeMax : balance
}

function mapCore(core) {
  return {
    creator: core?.[0],
    virtualETH: core?.[1] ?? 0n,
    virtualTokens: core?.[2] ?? 0n,
    realETH: core?.[3] ?? 0n,
    creatorAllocation: core?.[4] ?? 0n,
    createdAt: core?.[5] ?? 0n,
    pair: core?.[6],
    graduated: Boolean(core?.[7]),
  }
}

function mapStats(stats) {
  return {
    buys: stats?.[0] ?? 0n,
    sells: stats?.[1] ?? 0n,
    volume: stats?.[2] ?? 0n,
    holders: stats?.[3] ?? 0n,
    graduatedAt: stats?.[4] ?? 0n,
  }
}

function getCreatedToken(receipt) {
  if (!receipt?.logs?.length) return null
  try {
    const events = parseEventLogs({
      abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
      logs: receipt.logs,
      eventName: 'B20CurveCreated',
    })
    return events?.[0]?.args?.token || null
  } catch {
    return null
  }
}

async function waitForTx(hash, chainId) {
  const receipt = await Promise.race([
    waitForTransactionReceipt(config, {
      hash,
      chainId,
      confirmations: 1,
      pollingInterval: 2000,
    }),
    new Promise((_, reject) => setTimeout(() => {
      const timeoutError = new Error('Transaction submitted, but confirmation is taking longer than expected. Check the explorer before retrying.')
      timeoutError.txHash = hash
      timeoutError.isSubmitted = true
      reject(timeoutError)
    }, RECEIPT_TIMEOUT_MS)),
  ])
  if (!receipt || receipt.status !== 'success') throw new Error('Transaction reverted on-chain.')
  return receipt
}

export function useB20Launchpad() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { writeContractAsync } = useWriteContract()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const isSupported = isB20SupportedChainId(chainId)
  const isTestnet = isB20TestnetChainId(chainId)
  const dataChainId = isSupported ? Number(chainId) : NETWORKS.BASE.chainId
  const readClient = useMemo(() => getReadClient(dataChainId), [dataChainId])
  const launchpadAddress = useMemo(() => getB20CurveLaunchpadAddress(dataChainId), [dataChainId])

  const requireReady = useCallback(() => {
    if (!address) throw new Error('Wallet not connected')
    if (!isSupported) throw new Error('Switch to Base Sepolia for B20 curve testing, or Base after activation.')
    if (!launchpadAddress) {
      throw new Error('B20 curve launchpad is not configured for this network. Deploy BaseHubB20BondingLaunchpad and set VITE_B20_CURVE_LAUNCHPAD_*.')
    }
  }, [address, isSupported, launchpadAddress])

  const hydrateToken = useCallback((tokenAddress, meta, coreRaw, statsRaw, progressRaw) => {
    const core = mapCore(coreRaw)
    const stats = mapStats(statsRaw)
    return {
      address: tokenAddress,
      name: meta?.[0] || 'B20 Token',
      symbol: meta?.[1] || 'B20',
      description: meta?.[2] || '',
      image: meta?.[3] || '',
      core,
      stats,
      progress: Math.min(100, Number(progressRaw || 0n)),
      realEthLabel: Number(formatEther(core.realETH)).toFixed(4),
      volumeLabel: Number(formatEther(stats.volume)).toFixed(4),
      holdersLabel: Number(stats.holders || 0n).toLocaleString(),
      createdAtMs: Number(core.createdAt || 0n) * 1000,
    }
  }, [])

  const fetchTokens = useCallback(async ({
    knownTokens = [],
    knownTokensPromise = null,
    forceRefresh = false,
  } = {}) => {
    if (!readClient || !launchpadAddress) return []
    const readLaunchpad = (functionName, args = []) => withRetry(() => readClient.readContract({
      address: launchpadAddress,
      abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
      functionName,
      args,
    }))

    const count = await readLaunchpad('getAllTokensCount')

    const total = Number(count || 0n)
    if (!total) return []

    const readTokenBatch = async (offset, limit) => {
      try {
        return await readLaunchpad('getTokens', [BigInt(offset), BigInt(limit)])
      } catch (err) {
        if (limit <= 1) throw err
        const leftLimit = Math.floor(limit / 2)
        const rightLimit = limit - leftLimit
        const [left, right] = await Promise.all([
          readTokenBatch(offset, leftLimit),
          readTokenBatch(offset + leftLimit, rightLimit),
        ])
        return [...left, ...right]
      }
    }

    const tokenAddresses = []
    for (let offset = 0; offset < total; offset += TOKEN_BATCH_SIZE) {
      const limit = Math.min(TOKEN_BATCH_SIZE, total - offset)
      const batch = await readTokenBatch(offset, limit)
      if (Array.isArray(batch) && batch.length > 0) tokenAddresses.push(...batch)
      if (offset + TOKEN_BATCH_SIZE < total) await sleep(150)
    }

    const uniqueAddresses = Array.from(new Set(tokenAddresses.map((item) => String(item).toLowerCase())))
    if (!uniqueAddresses.length) return []

    let resolvedKnownTokens = Array.isArray(knownTokens) ? knownTokens : []
    if (!forceRefresh && knownTokensPromise) {
      const promisedTokens = await Promise.race([
        knownTokensPromise,
        sleep(2500).then(() => []),
      ]).catch(() => [])
      if (Array.isArray(promisedTokens) && promisedTokens.length > 0) {
        resolvedKnownTokens = promisedTokens
      }
    }
    const knownByAddress = new Map(
      resolvedKnownTokens
        .filter((token) => token?.address)
        .map((token) => [String(token.address).toLowerCase(), token])
    )
    const addressesToHydrate = forceRefresh
      ? uniqueAddresses
      : uniqueAddresses.filter((tokenAddress) => !knownByAddress.has(tokenAddress))

    if (addressesToHydrate.length === 0) {
      return uniqueAddresses
        .map((tokenAddress) => knownByAddress.get(tokenAddress))
        .filter(Boolean)
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    }

    const contracts = []
    addressesToHydrate.forEach((tokenAddress) => {
      contracts.push(
        { address: launchpadAddress, abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI, functionName: 'getTokenMeta', args: [tokenAddress] },
        { address: launchpadAddress, abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI, functionName: 'tokenCore', args: [tokenAddress] },
        { address: launchpadAddress, abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI, functionName: 'tokenStats', args: [tokenAddress] },
        { address: launchpadAddress, abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI, functionName: 'getGraduationProgress', args: [tokenAddress] }
      )
    })

    let results
    try {
      results = await readClient.multicall({ contracts, allowFailure: true })
    } catch {
      results = []
      const chunkSize = 12
      for (let index = 0; index < contracts.length; index += chunkSize) {
        const chunk = contracts.slice(index, index + chunkSize)
        try {
          const chunkResults = await withRetry(
            () => readClient.multicall({ contracts: chunk, allowFailure: true }),
            { attempts: 2, delayMs: 750 }
          )
          results.push(...chunkResults)
        } catch {
          results.push(...chunk.map(() => ({ status: 'failure' })))
        }
        if (index + chunkSize < contracts.length) await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    const hydrateSingleToken = async (tokenAddress) => {
      const [meta, core, stats, progress] = await Promise.all([
        readLaunchpad('getTokenMeta', [tokenAddress]),
        readLaunchpad('tokenCore', [tokenAddress]),
        readLaunchpad('tokenStats', [tokenAddress]),
        readLaunchpad('getGraduationProgress', [tokenAddress]).catch(() => 0n),
      ])
      return hydrateToken(tokenAddress, meta, core, stats, progress)
    }

    const hydratedByAddress = new Map()
    for (let index = 0; index < addressesToHydrate.length; index++) {
      const tokenAddress = addressesToHydrate[index]
      const metaResult = results[index * 4]
      const coreResult = results[index * 4 + 1]
      const statsResult = results[index * 4 + 2]
      const progressResult = results[index * 4 + 3]
      if (metaResult?.status === 'failure' || coreResult?.status === 'failure' || statsResult?.status === 'failure') {
        try {
          hydratedByAddress.set(tokenAddress, await hydrateSingleToken(tokenAddress))
        } catch {
          // A single malformed or temporarily unavailable token must not hide the market.
        }
      } else {
        hydratedByAddress.set(tokenAddress, hydrateToken(
          tokenAddress,
          metaResult?.result,
          coreResult?.result,
          statsResult?.result,
          progressResult?.status === 'failure' ? 0n : progressResult?.result
        ))
      }
    }

    return uniqueAddresses
      .map((tokenAddress) => hydratedByAddress.get(tokenAddress) || knownByAddress.get(tokenAddress))
      .filter(Boolean)
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
  }, [hydrateToken, launchpadAddress, readClient])

  const createCurveToken = useCallback(async (input) => {
    requireReady()
    const name = cleanName(input.name)
    const symbol = cleanSymbol(input.symbol)
    const description = cleanText(input.description)
    const image = cleanUrl(input.image)
    const creatorAllocationBps = BigInt(Math.max(0, Math.min(1000, Math.round(toNumber(input.creatorAllocationBps)))))
    if (!name) throw new Error('Token name is required')
    if (!symbol) throw new Error('Token symbol is required')

    setIsLoading(true)
    setError(null)
    try {
      const userSalt = keccak256(stringToBytes(`${address}:${Date.now()}:${name}:${symbol}:b20-curve`))
      const predictedToken = await readClient.readContract({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'predictToken',
        args: [address, userSalt],
      })

      await readClient.simulateContract({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'createCurveB20',
        args: [name, symbol, description, image, creatorAllocationBps, userSalt],
        account: address,
        value: parseEther(B20_CURVE_CREATE_FEE_ETH),
      })

      const hash = await writeContractAsync({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'createCurveB20',
        args: [name, symbol, description, image, creatorAllocationBps, userSalt],
        value: parseEther(B20_CURVE_CREATE_FEE_ETH),
        chainId: Number(chainId),
        dataSuffix: DATA_SUFFIX,
      })
      const receipt = await waitForTx(hash, Number(chainId))

      let xpEarned = 0
      if (Number(chainId) === NETWORKS.BASE.chainId) {
        try {
          await addXP(address, B20_XP_REWARD, B20_XP_GAME_TYPE, Number(chainId), false, hash)
          xpEarned = B20_XP_REWARD
        } catch (xpError) {
          console.error('B20 curve XP award failed:', xpError)
        }
      }

      return {
        txHash: hash,
        tokenAddress: getCreatedToken(receipt) || predictedToken,
        predictedToken,
        fee: `${B20_CURVE_CREATE_FEE_ETH} ETH`,
        xpEarned,
      }
    } catch (err) {
      setError(err.shortMessage || err.message || 'B20 curve launch failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [address, chainId, launchpadAddress, readClient, requireReady, writeContractAsync])

  const buyTokens = useCallback(async (tokenAddress, ethAmount) => {
    requireReady()
    const value = parseEther(normalizeDecimalInput(ethAmount, 18))
    if (value <= 0n) throw new Error('Enter an ETH amount')
    setIsLoading(true)
    setError(null)
    try {
      const quote = await readClient.readContract({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'getTokensForETH',
        args: [tokenAddress, value],
      })
      const minOut = quote > 0n ? (quote * 97n) / 100n : 0n
      const hash = await writeContractAsync({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'buy',
        args: [tokenAddress, minOut],
        value,
        chainId: Number(chainId),
        dataSuffix: DATA_SUFFIX,
      })
      await waitForTx(hash, Number(chainId))
      return { txHash: hash, quotedTokens: quote }
    } catch (err) {
      setError(err.shortMessage || err.message || 'B20 buy failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [chainId, launchpadAddress, readClient, requireReady, writeContractAsync])

  const sellTokens = useCallback(async (tokenAddress, tokenAmount) => {
    requireReady()
    const amount = parseUnits(normalizeDecimalInput(tokenAmount, 18), 18)
    if (amount <= 0n) throw new Error('Enter a token amount')
    setIsLoading(true)
    setError(null)
    try {
      const [allowance, balance, coreRaw] = await Promise.all([
        readClient.readContract({
          address: tokenAddress,
          abi: B20_CURVE_ERC20_ABI,
          functionName: 'allowance',
          args: [address, launchpadAddress],
        }),
        readClient.readContract({
          address: tokenAddress,
          abi: B20_CURVE_ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
        readClient.readContract({
          address: launchpadAddress,
          abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
          functionName: 'tokenCore',
          args: [tokenAddress],
        }),
      ])
      const maxSellable = getMaxCurveSellAmount(mapCore(coreRaw), balance)
      if (amount > balance) throw new Error(`Insufficient token balance. Balance: ${formatUnits(balance, 18)}`)
      if (amount > maxSellable) {
        throw new Error(`Sell amount is above current curve liquidity. Max now: ${formatUnits(maxSellable, 18)} tokens`)
      }

      if (allowance < amount) {
        const approveHash = await writeContractAsync({
          address: tokenAddress,
          abi: B20_CURVE_ERC20_ABI,
          functionName: 'approve',
          args: [launchpadAddress, maxUint256],
          chainId: Number(chainId),
          dataSuffix: DATA_SUFFIX,
        })
        await waitForTx(approveHash, Number(chainId))
      }

      const quote = await readClient.readContract({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'getETHForTokens',
        args: [tokenAddress, amount],
      })
      const minOut = quote > 0n ? (quote * 97n) / 100n : 0n
      const hash = await writeContractAsync({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'sell',
        args: [tokenAddress, amount, minOut],
        chainId: Number(chainId),
        dataSuffix: DATA_SUFFIX,
      })
      await waitForTx(hash, Number(chainId))
      return { txHash: hash, quotedEth: quote }
    } catch (err) {
      setError(err.shortMessage || err.message || 'B20 sell failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [address, chainId, launchpadAddress, readClient, requireReady, writeContractAsync])

  const claimFees = useCallback(async () => {
    requireReady()
    const hash = await writeContractAsync({
      address: launchpadAddress,
      abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
      functionName: 'claimFees',
      chainId: Number(chainId),
      dataSuffix: DATA_SUFFIX,
    })
    await waitForTx(hash, Number(chainId))
    return { txHash: hash }
  }, [chainId, launchpadAddress, requireReady, writeContractAsync])

  return {
    launchpadAddress,
    dataChainId,
    isSupported,
    isTestnet,
    isLoading,
    error,
    fetchTokens,
    createCurveToken,
    buyTokens,
    sellTokens,
    claimFees,
    formatTokenAmount: (value) => Number(formatUnits(value || 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 }),
  }
}
