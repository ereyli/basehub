import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import { createPublicClient, decodeEventLog, formatEther, http, parseEther } from 'viem'
import { base } from 'viem/chains'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'
import EmbedMeta from '../components/EmbedMeta'
import { getFarcasterUniversalLink } from '../config/farcaster'
import { TUG_OF_WAR_ABI, TUG_OF_WAR_ADDRESS } from '../config/tugOfWar'
import { supabase } from '../config/supabase'
import { DATA_SUFFIX } from '../config/wagmi'
import { addXP } from '../utils/xpUtils'

const formatCountdown = (seconds) => {
  if (seconds <= 0) return 'Ended'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

const formatShortAddress = (value = '') => `${value.slice(0, 6)}...${value.slice(-4)}`
const formatEth = (v) => Number(formatEther(v || 0n)).toFixed(4)
const formatMarketTitle = (question = '') => {
  const q = (question || '').trim()
  if (!q) return 'Untitled'
  if (q.length <= 2) return `Question: ${q}`
  return q
}
const TOW_TABLES = {
  MARKETS: 'prediction_arena_markets',
  BETS: 'prediction_arena_bets',
  CLAIMS: 'prediction_arena_claims',
}
const XP_REWARDS = {
  CREATE_MARKET: 2000,
  PLACE_BET: 200,
}

const PredictionArena = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const fallbackClient = useMemo(
    () => createPublicClient({ chain: base, transport: http('https://base-rpc.publicnode.com') }),
    []
  )
  const { writeContractAsync } = useWriteContract()

  const [markets, setMarkets] = useState([])
  const [question, setQuestion] = useState('')
  const [durationSeconds, setDurationSeconds] = useState(3600)
  const [betInputs, setBetInputs] = useState({})
  const [activeTab, setActiveTab] = useState('markets')
  const [marketView, setMarketView] = useState('predictions')
  const [marketSort, setMarketSort] = useState('newest')
  const [status, setStatus] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  const loadGuardRef = useRef({ inFlight: false, lastAt: 0 })
  const backfillGuardRef = useRef(false)
  const reconcileGuardRef = useRef({ inFlight: false, lastAt: 0 })

  const { data: createFeeEth } = useReadContract({
    address: TUG_OF_WAR_ADDRESS,
    abi: TUG_OF_WAR_ABI,
    functionName: 'createFeeEth',
  })

  const { data: maxBetPerUser } = useReadContract({
    address: TUG_OF_WAR_ADDRESS,
    abi: TUG_OF_WAR_ABI,
    functionName: 'maxBetPerUser',
  })

  const { data: platformFeeBps } = useReadContract({
    address: TUG_OF_WAR_ADDRESS,
    abi: TUG_OF_WAR_ABI,
    functionName: 'platformFeeBps',
  })

  const { data: lockWindowSeconds } = useReadContract({
    address: TUG_OF_WAR_ADDRESS,
    abi: TUG_OF_WAR_ABI,
    functionName: 'lockWindowSeconds',
  })

  const { data: minDurationSeconds } = useReadContract({
    address: TUG_OF_WAR_ADDRESS,
    abi: TUG_OF_WAR_ABI,
    functionName: 'minDurationSeconds',
  })

  const { data: maxDurationSeconds } = useReadContract({
    address: TUG_OF_WAR_ADDRESS,
    abi: TUG_OF_WAR_ABI,
    functionName: 'maxDurationSeconds',
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  const durationOptions = useMemo(
    () => [
      { label: '1 hour', value: 3600 },
      { label: '2 hours', value: 7200 },
      { label: '6 hours', value: 21600 },
      { label: '12 hours', value: 43200 },
      { label: '24 hours', value: 86400 },
    ],
    []
  )

  const getMarketStatus = useCallback((market) => {
    if (market.resolved) return 'resolved'
    if (market.endTime <= now) return 'expired'
    return 'active'
  }, [now])

  const getMarketShareIntentUrl = useCallback((market) => {
    const webBase = typeof window !== 'undefined' ? window.location.origin : 'https://basehub.fun'
    const marketUrl = `${webBase}/prediction-arena?market=${market.id}#market-${market.id}`
    const farcasterUrl = getFarcasterUniversalLink(`/prediction-arena?market=${market.id}`)
    const tweetText = `Prediction Arena: "${market.question}"\n\nJoin this market:`
    return `https://x.com/intent/tweet?text=${encodeURIComponent(`${tweetText}\n${farcasterUrl}`)}&url=${encodeURIComponent(marketUrl)}`
  }, [])

  const syncMarketsToSupabase = useCallback(async (rows, snapshotNow) => {
    if (!supabase?.from || !rows?.length) return
    try {
      setIsSyncing(true)
      const currentNow = snapshotNow || Math.floor(Date.now() / 1000)
      const upsertRows = rows.map((m) => ({
        market_id: m.id,
        question: m.question,
        creator: m.creator.toLowerCase(),
        contract_address: TUG_OF_WAR_ADDRESS.toLowerCase(),
        chain_id: 8453,
        end_time: new Date(m.endTime * 1000).toISOString(),
        status: m.resolved ? 'resolved' : (m.endTime <= currentNow ? 'expired' : 'active'),
        resolved: m.resolved,
        winning_side: m.resolved ? m.winningSide : null,
        total_yes_wei: m.totalYes.toString(),
        total_no_wei: m.totalNo.toString(),
        fee_amount_wei: m.feeAmount.toString(),
        distributable_pool_wei: m.distributablePool.toString(),
        imbalance_bps: Number(m.imbalanceBps || 0),
        warning: Boolean(m.isWarning),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from(TOW_TABLES.MARKETS).upsert(upsertRows, {
        onConflict: 'market_id',
      })
      if (error) {
        console.error('Supabase market sync error:', error)
      }
    } catch (error) {
      console.error('Supabase market sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const readContractWithRetry = useCallback(async (params, retries = 3) => {
    let lastError
    for (let i = 0; i < retries; i += 1) {
      try {
        return await publicClient.readContract(params)
      } catch (error) {
        lastError = error
        const msg = String(error?.message || '')
        const isRateLimited = msg.includes('429') || msg.toLowerCase().includes('rate limit')
        if (!isRateLimited || i === retries - 1) break
        await sleep(400 * (i + 1) * (i + 1))
      }
    }
    throw lastError
  }, [publicClient])

  const backfillMissingMarkets = useCallback(async (knownMarketIds = []) => {
    if (!publicClient || !supabase?.from || backfillGuardRef.current) return
    try {
      backfillGuardRef.current = true
      const known = new Set((knownMarketIds || []).map((id) => Number(id)))
      const chainCountRaw = await readContractWithRetry({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'marketCount',
      })
      const chainCount = Number(chainCountRaw || 0)
      if (!chainCount || chainCount <= known.size) return

      const missing = []
      for (let i = chainCount; i >= 1; i -= 1) {
        if (!known.has(i)) missing.push(i)
        if (missing.length >= 20) break
      }
      if (!missing.length) return

      const rows = []
      for (const marketId of missing) {
        try {
          const market = await readContractWithRetry({
            address: TUG_OF_WAR_ADDRESS,
            abi: TUG_OF_WAR_ABI,
            functionName: 'getMarket',
            args: [BigInt(marketId)],
          }, 4)

          rows.push({
            market_id: marketId,
            question: market.question,
            creator: String(market.creator || '').toLowerCase(),
            contract_address: TUG_OF_WAR_ADDRESS.toLowerCase(),
            chain_id: 8453,
            end_time: new Date(Number(market.endTime) * 1000).toISOString(),
            status: market.resolved ? 'resolved' : (Number(market.endTime) <= Math.floor(Date.now() / 1000) ? 'expired' : 'active'),
            resolved: !!market.resolved,
            winning_side: market.resolved ? Number(market.winningSide) : null,
            total_yes_wei: String(market.totalYes || 0n),
            total_no_wei: String(market.totalNo || 0n),
            fee_amount_wei: String(market.feeAmount || 0n),
            distributable_pool_wei: String(market.distributablePool || 0n),
            imbalance_bps: 0,
            warning: false,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        } catch (error) {
          console.error(`Backfill failed for market ${marketId}:`, error)
        }
      }

      if (rows.length) {
        const { error } = await supabase.from(TOW_TABLES.MARKETS).upsert(rows, { onConflict: 'market_id' })
        if (!error) {
          setStatus((prev) => prev || `Synced ${rows.length} missing market(s) from chain.`)
        }
      }
    } catch (error) {
      console.error('Backfill missing markets failed:', error)
    } finally {
      backfillGuardRef.current = false
    }
  }, [publicClient, readContractWithRetry, supabase])

  const loadMarkets = useCallback(async () => {
    if (!supabase?.from) return
    try {
      const { data: marketRows, error: marketError } = await supabase
        .from(TOW_TABLES.MARKETS)
        .select('*')
        .eq('contract_address', TUG_OF_WAR_ADDRESS.toLowerCase())
        .order('market_id', { ascending: false })

      if (marketError) throw marketError

      const byMarketUser = new Map()
      const claimedMarkets = new Set()
      const marketStats = new Map()
      const ids = (marketRows || []).map((m) => Number(m.market_id))
      const normalizedAddress = address?.toLowerCase()

      if (ids.length) {
        const { data: allBets } = await supabase
          .from(TOW_TABLES.BETS)
          .select('market_id, user_address, side, amount_wei')
          .in('market_id', ids)

        ;(allBets || []).forEach((b) => {
          const marketId = Number(b.market_id)
          const current = marketStats.get(marketId) || { participants: new Set(), totalBets: 0, yesTotal: 0n, noTotal: 0n }
          const amount = BigInt(b.amount_wei || 0)
          current.participants.add((b.user_address || '').toLowerCase())
          if (b.side === 'yes') current.yesTotal += amount
          if (b.side === 'no') current.noTotal += amount
          current.totalBets += 1
          marketStats.set(marketId, current)

          if (normalizedAddress && (b.user_address || '').toLowerCase() === normalizedAddress) {
            const mine = byMarketUser.get(marketId) || { yes: 0n, no: 0n }
            if (b.side === 'yes') mine.yes += amount
            if (b.side === 'no') mine.no += amount
            byMarketUser.set(marketId, mine)
          }
        })
      }

      if (normalizedAddress && ids.length) {
        const { data: userClaims } = await supabase
          .from(TOW_TABLES.CLAIMS)
          .select('market_id')
          .eq('user_address', normalizedAddress)
          .in('market_id', ids)

        ;(userClaims || []).forEach((c) => claimedMarkets.add(Number(c.market_id)))
      }

      const mapped = (marketRows || []).map((m) => {
        const marketId = Number(m.market_id)
        const stats = marketStats.get(marketId)
        const totalYes = stats ? stats.yesTotal : BigInt(m.total_yes_wei || 0)
        const totalNo = stats ? stats.noTotal : BigInt(m.total_no_wei || 0)
        const userStake = byMarketUser.get(marketId) || { yes: 0n, no: 0n }
        const ws = Number(m.winning_side || 0)
        const isTie = ws === 3
        const winnerTotal = isTie ? totalYes + totalNo : (ws === 1 ? totalYes : totalNo)
        const winnerStake = isTie ? userStake.yes + userStake.no : (ws === 1 ? userStake.yes : userStake.no)
        let claimable = 0n
        if (m.resolved && !claimedMarkets.has(marketId) && winnerTotal > 0n && winnerStake > 0n) {
          claimable = (BigInt(m.distributable_pool_wei || 0) * winnerStake) / winnerTotal
        }

        return {
          id: marketId,
          question: m.question,
          creator: m.creator,
          createdAt: m.created_at ? new Date(m.created_at).getTime() : 0,
          endTime: Math.floor(new Date(m.end_time).getTime() / 1000),
          totalYes,
          totalNo,
          resolved: !!m.resolved,
          winningSide: Number(m.winning_side || 0),
          feeAmount: BigInt(m.fee_amount_wei || 0),
          distributablePool: BigInt(m.distributable_pool_wei || 0),
          yesTotal: totalYes,
          noTotal: totalNo,
          imbalanceBps: BigInt(m.imbalance_bps || 0),
          isWarning: !!m.warning,
          locked: false,
          yesStake: userStake.yes,
          noStake: userStake.no,
          claimable,
          participantCount: (stats?.participants?.size) || 0,
          totalBetCount: stats?.totalBets || 0,
        }
      })

      setMarkets(mapped)
      setStatus('')
      if (publicClient) {
        await backfillMissingMarkets(mapped.map((m) => m.id))
        const { data: freshRows } = await supabase
          .from(TOW_TABLES.MARKETS)
          .select('*')
          .eq('contract_address', TUG_OF_WAR_ADDRESS.toLowerCase())
          .order('market_id', { ascending: false })
        if (freshRows && freshRows.length !== (marketRows || []).length) {
          const remapped = freshRows.map((m) => {
            const marketId = Number(m.market_id)
            const stats = marketStats.get(marketId)
            const totalYes = stats ? stats.yesTotal : BigInt(m.total_yes_wei || 0)
            const totalNo = stats ? stats.noTotal : BigInt(m.total_no_wei || 0)
            const userStake = byMarketUser.get(marketId) || { yes: 0n, no: 0n }
            const ws = Number(m.winning_side || 0)
            const isTie = ws === 3
            const winnerTotal = isTie ? totalYes + totalNo : (ws === 1 ? totalYes : totalNo)
            const winnerStake = isTie ? userStake.yes + userStake.no : (ws === 1 ? userStake.yes : userStake.no)
            let claimable = 0n
            if (m.resolved && !claimedMarkets.has(marketId) && winnerTotal > 0n && winnerStake > 0n) {
              claimable = (BigInt(m.distributable_pool_wei || 0) * winnerStake) / winnerTotal
            }

            return {
              id: marketId,
              question: m.question,
              creator: m.creator,
              createdAt: m.created_at ? new Date(m.created_at).getTime() : 0,
              endTime: Math.floor(new Date(m.end_time).getTime() / 1000),
              totalYes,
              totalNo,
              resolved: !!m.resolved,
              winningSide: Number(m.winning_side || 0),
              feeAmount: BigInt(m.fee_amount_wei || 0),
              distributablePool: BigInt(m.distributable_pool_wei || 0),
              yesTotal: totalYes,
              noTotal: totalNo,
              imbalanceBps: BigInt(m.imbalance_bps || 0),
              isWarning: !!m.warning,
              locked: false,
              yesStake: userStake.yes,
              noStake: userStake.no,
              claimable,
              participantCount: (stats?.participants?.size) || 0,
              totalBetCount: stats?.totalBets || 0,
            }
          })
          setMarkets(remapped)
        }
      }
    } catch (error) {
      console.error('Failed to load Supabase markets:', error)
      setStatus('Failed to load markets from Supabase')
    }
  }, [address, backfillMissingMarkets, publicClient])

  const syncMarketsFromChain = useCallback(async (force = false) => {
    if (!publicClient) return
    const currentTsMs = Date.now()
    if (loadGuardRef.current.inFlight) return
    if (!force && currentTsMs - loadGuardRef.current.lastAt < 3500) return
    loadGuardRef.current.inFlight = true
    loadGuardRef.current.lastAt = currentTsMs
    try {
      const countRaw = await publicClient.readContract({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'marketCount',
      })

      const count = Number(countRaw)
      if (!count) {
        setMarkets([])
        return
      }

      const ids = Array.from({ length: count }, (_, i) => count - i)
      const settled = await Promise.allSettled(
        ids.map(async (id) => {
          const market = await publicClient.readContract({
            address: TUG_OF_WAR_ADDRESS,
            abi: TUG_OF_WAR_ABI,
            functionName: 'getMarket',
            args: [BigInt(id)],
          })

          const [yesTotal, noTotal, imbalanceBps, isWarning] = await publicClient.readContract({
            address: TUG_OF_WAR_ADDRESS,
            abi: TUG_OF_WAR_ABI,
            functionName: 'getMarketImbalance',
            args: [BigInt(id)],
          })

          const locked = await publicClient.readContract({
            address: TUG_OF_WAR_ADDRESS,
            abi: TUG_OF_WAR_ABI,
            functionName: 'isBetLocked',
            args: [BigInt(id)],
          })

          let yesStake = 0n
          let noStake = 0n
          let claimable = 0n
          if (address) {
            const [ys, ns] = await publicClient.readContract({
              address: TUG_OF_WAR_ADDRESS,
              abi: TUG_OF_WAR_ABI,
              functionName: 'getUserStakes',
              args: [BigInt(id), address],
            })
            yesStake = ys
            noStake = ns
            claimable = await publicClient.readContract({
              address: TUG_OF_WAR_ADDRESS,
              abi: TUG_OF_WAR_ABI,
              functionName: 'getClaimable',
              args: [BigInt(id), address],
            })
          }

          return {
            id,
            question: market.question,
            creator: market.creator,
            endTime: Number(market.endTime),
            totalYes: market.totalYes,
            totalNo: market.totalNo,
            resolved: market.resolved,
            winningSide: Number(market.winningSide),
            feeAmount: market.feeAmount,
            distributablePool: market.distributablePool,
            yesTotal,
            noTotal,
            imbalanceBps,
            isWarning,
            locked,
            yesStake,
            noStake,
            claimable,
          }
        })
      )

      const rows = settled
        .filter((s) => s.status === 'fulfilled')
        .map((s) => s.value)
      await syncMarketsToSupabase(rows, Math.floor(currentTsMs / 1000))
    } catch (error) {
      console.error('Failed to sync markets from chain:', error)
      setStatus('Chain sync limited by RPC. Showing Supabase data.')
    } finally {
      loadGuardRef.current.inFlight = false
    }
  }, [publicClient, address, syncMarketsToSupabase])

  useEffect(() => {
    loadMarkets()
  }, [loadMarkets])

  const waitForTx = async (hash) => {
    if (!publicClient) return
    return await publicClient.waitForTransactionReceipt({ hash })
  }

  const syncSingleMarketFromChain = useCallback(async (marketId) => {
    if ((!publicClient && !fallbackClient) || !supabase?.from) return
    try {
      const readWithFallback = async (params) => {
        if (publicClient) {
          try {
            return await readContractWithRetry(params, 4)
          } catch (_) {
            // fallback RPC below
          }
        }
        return await fallbackClient.readContract(params)
      }

      const market = await readWithFallback({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'getMarket',
        args: [BigInt(marketId)],
      })

      const [, , imbalanceBps, isWarning] = await readWithFallback({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'getMarketImbalance',
        args: [BigInt(marketId)],
      })

      const marketEndTime = Number(market.endTime)
      const chainNow = Math.floor(Date.now() / 1000)
      await supabase.from(TOW_TABLES.MARKETS).upsert({
        market_id: marketId,
        question: market.question,
        creator: String(market.creator || '').toLowerCase(),
        contract_address: TUG_OF_WAR_ADDRESS.toLowerCase(),
        chain_id: 8453,
        end_time: new Date(marketEndTime * 1000).toISOString(),
        status: market.resolved ? 'resolved' : (marketEndTime <= chainNow ? 'expired' : 'active'),
        resolved: !!market.resolved,
        winning_side: market.resolved ? Number(market.winningSide) : null,
        total_yes_wei: String(market.totalYes || 0n),
        total_no_wei: String(market.totalNo || 0n),
        fee_amount_wei: String(market.feeAmount || 0n),
        distributable_pool_wei: String(market.distributablePool || 0n),
        imbalance_bps: Number(imbalanceBps || 0n),
        warning: Boolean(isWarning),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'market_id' })
    } catch (error) {
      console.error(`Failed to sync market ${marketId} from chain:`, error)
    }
  }, [publicClient, fallbackClient, readContractWithRetry])

  const waitForResolvedInSupabase = useCallback(async (marketId, maxAttempts = 8) => {
    if (!supabase?.from) return false
    for (let i = 0; i < maxAttempts; i += 1) {
      try {
        const { data } = await supabase
          .from(TOW_TABLES.MARKETS)
          .select('resolved')
          .eq('market_id', marketId)
          .maybeSingle()
        if (data?.resolved) return true
      } catch (_) {
        // ignore transient read errors during retries
      }
      await sleep(1000)
    }
    return false
  }, [])

  useEffect(() => {
    if (!supabase?.from) return
    const run = async () => {
      const nowMs = Date.now()
      if (reconcileGuardRef.current.inFlight) return
      if (nowMs - reconcileGuardRef.current.lastAt < 15000) return
      reconcileGuardRef.current.inFlight = true
      reconcileGuardRef.current.lastAt = nowMs
      try {
        const { data: pendingRows } = await supabase
          .from(TOW_TABLES.MARKETS)
          .select('market_id,end_time,resolved,total_yes_wei,total_no_wei')
          .eq('contract_address', TUG_OF_WAR_ADDRESS.toLowerCase())
          .eq('resolved', false)
          .order('end_time', { ascending: true })
          .limit(8)

        const staleIds = (pendingRows || [])
          .filter((m) => new Date(m.end_time).getTime() <= Date.now() && ((m.total_yes_wei !== '0') || (m.total_no_wei !== '0')))
          .map((m) => Number(m.market_id))

        if (!staleIds.length) return
        await Promise.allSettled(staleIds.map((id) => syncSingleMarketFromChain(id)))
        await loadMarkets()
      } catch (_) {
        // silent retry next tick
      } finally {
        reconcileGuardRef.current.inFlight = false
      }
    }
    run()
  }, [now, loadMarkets, syncSingleMarketFromChain])

  const handleCreateMarket = async () => {
    if (!isConnected) return alert('Please connect wallet')
    if (!question.trim()) return alert('Please enter a question')
    if (!createFeeEth) return alert('Create fee not loaded')
    if (!publicClient) return alert('RPC client not ready')

    try {
      setIsBusy(true)
      setStatus('Creating market...')
      const normalizedQuestion = question.trim()
      // Use chain time (not device clock) to avoid InvalidDuration reverts.
      const latestBlock = await publicClient.getBlock()
      const chainNow = Number(latestBlock.timestamp)
      const minDur = Number(minDurationSeconds || 3600)
      const maxDur = Number(maxDurationSeconds || 86400)
      const minBoundarySlack = 180
      const maxBoundarySlack = 120
      let safeDuration = Number(durationSeconds)

      if (safeDuration <= minDur) {
        safeDuration = minDur + minBoundarySlack
      }
      if (safeDuration >= maxDur) {
        safeDuration = Math.max(minDur + 1, maxDur - maxBoundarySlack)
      }

      const endTime = BigInt(chainNow + safeDuration)
      const hash = await writeContractAsync({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'createMarket',
        args: [normalizedQuestion, endTime],
        value: createFeeEth,
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      const receipt = await waitForTx(hash)

      // Ensure the newly created market appears immediately in Supabase-driven UI.
      if (supabase?.from && receipt?.logs?.length) {
        let createdMarketId = null
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: TUG_OF_WAR_ABI,
              data: log.data,
              topics: log.topics,
            })
            if (decoded?.eventName === 'MarketCreated') {
              createdMarketId = Number(decoded.args?.marketId || 0)
              break
            }
          } catch (_) {
            // ignore unrelated logs
          }
        }

        if (createdMarketId) {
          await supabase.from(TOW_TABLES.MARKETS).upsert({
            market_id: createdMarketId,
            question: normalizedQuestion,
            creator: (address || '').toLowerCase(),
            contract_address: TUG_OF_WAR_ADDRESS.toLowerCase(),
            chain_id: 8453,
            end_time: new Date(Number(endTime) * 1000).toISOString(),
            status: 'active',
            resolved: false,
            winning_side: null,
            total_yes_wei: '0',
            total_no_wei: '0',
            fee_amount_wei: '0',
            distributable_pool_wei: '0',
            imbalance_bps: 0,
            warning: false,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'market_id' })
        }
      }
      setQuestion('')
      setStatus('Market created successfully')

      if (address) {
        try {
          await addXP(address, XP_REWARDS.CREATE_MARKET, 'PREDICTION_MARKET_CREATE', chainId, true, hash)
        } catch (xpError) {
          console.error('Prediction create XP/record failed:', xpError)
        }
      }

      await syncMarketsFromChain(true)
      await loadMarkets()
    } catch (error) {
      console.error(error)
      setStatus(error?.shortMessage || error?.message || 'Create market failed')
    } finally {
      setIsBusy(false)
    }
  }

  const handleBet = async (marketId, forYes) => {
    if (!isConnected) return alert('Please connect wallet')
    const value = (betInputs[marketId] || '').trim()
    if (!value) return alert('Enter bet amount in ETH')

    try {
      const wei = parseEther(value)
      if (wei <= 0n) return alert('Bet must be greater than 0')
      if (maxBetPerUser && wei > maxBetPerUser) {
        return alert(`Max single-side bet is ${formatEther(maxBetPerUser)} ETH`)
      }

      const market = markets.find((m) => m.id === marketId)
      if (market && maxBetPerUser) {
        const userSideStake = forYes ? market.yesStake : market.noStake
        if (userSideStake + wei > maxBetPerUser) {
          const remaining = maxBetPerUser - userSideStake
          return alert(`Remaining limit on this side: ${formatEther(remaining)} ETH`)
        }
      }

      setIsBusy(true)
      setStatus(`Placing ${forYes ? 'YES' : 'NO'} bet...`)
      const hash = await writeContractAsync({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'bet',
        args: [BigInt(marketId), forYes],
        value: wei,
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      const receipt = await waitForTx(hash)
      if (supabase?.from) {
        await supabase.from(TOW_TABLES.BETS).insert({
          market_id: marketId,
          user_address: address?.toLowerCase(),
          side: forYes ? 'yes' : 'no',
          amount_wei: wei.toString(),
          tx_hash: hash,
          created_at: new Date().toISOString(),
        })
        if (receipt?.blockNumber) {
          await supabase.from(TOW_TABLES.MARKETS).upsert({
            market_id: marketId,
            contract_address: TUG_OF_WAR_ADDRESS.toLowerCase(),
            chain_id: 8453,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'market_id' })
        }
      }
      setStatus('Bet placed successfully')
      setBetInputs((prev) => ({ ...prev, [marketId]: '' }))

      if (address) {
        try {
          await addXP(address, XP_REWARDS.PLACE_BET, 'PREDICTION_MARKET_BET', chainId, true, hash)
        } catch (xpError) {
          console.error('Prediction bet XP/record failed:', xpError)
        }
      }

      await syncMarketsFromChain(true)
      await loadMarkets()
    } catch (error) {
      console.error(error)
      setStatus(error?.shortMessage || error?.message || 'Bet failed')
    } finally {
      setIsBusy(false)
    }
  }

  const handleResolve = async (marketId) => {
    if (!isConnected) return alert('Please connect wallet')
    try {
      setIsBusy(true)
      setStatus('Resolving market...')
      const hash = await writeContractAsync({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'resolve',
        args: [BigInt(marketId)],
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      const receipt = await waitForTx(hash)

      // Optimistic update from tx logs so UI moves immediately even if RPC is rate-limited.
      let resolvedFromLog = null
      if (receipt?.logs?.length) {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: TUG_OF_WAR_ABI,
              data: log.data,
              topics: log.topics,
            })
            if (decoded?.eventName === 'MarketResolved' && Number(decoded.args?.marketId) === Number(marketId)) {
              resolvedFromLog = {
                winningSide: Number(decoded.args?.winningSide || 0),
                feeAmount: BigInt(decoded.args?.feeAmount || 0n),
              }
              break
            }
          } catch (_) {
            // ignore unrelated logs
          }
        }
      }

      // Immediate local UI move to finished even before sync completes.
      setMarkets((prev) => prev.map((m) => {
        if (m.id !== marketId) return m
        const totalPool = (m.totalYes || 0n) + (m.totalNo || 0n)
        const fallbackWinningSide = m.totalYes >= m.totalNo ? 1 : 2
        const winningSide = resolvedFromLog?.winningSide || fallbackWinningSide
        const feeAmount = resolvedFromLog?.feeAmount || 0n
        return {
          ...m,
          resolved: true,
          winningSide,
          feeAmount,
          distributablePool: totalPool > feeAmount ? (totalPool - feeAmount) : 0n,
          claimable: 0n,
        }
      }))

      if (resolvedFromLog) {
        const currentNow = Math.floor(Date.now() / 1000)
        setMarkets((prev) => prev.map((m) => {
          if (m.id !== marketId) return m
          const totalPool = (m.totalYes || 0n) + (m.totalNo || 0n)
          return {
            ...m,
            resolved: true,
            winningSide: resolvedFromLog.winningSide,
            feeAmount: resolvedFromLog.feeAmount,
            distributablePool: totalPool > resolvedFromLog.feeAmount ? (totalPool - resolvedFromLog.feeAmount) : 0n,
            claimable: 0n,
          }
        }))

        await supabase.from(TOW_TABLES.MARKETS).upsert({
          market_id: marketId,
          contract_address: TUG_OF_WAR_ADDRESS.toLowerCase(),
          chain_id: 8453,
          status: 'resolved',
          resolved: true,
          winning_side: resolvedFromLog.winningSide,
          fee_amount_wei: resolvedFromLog.feeAmount.toString(),
          last_synced_at: new Date(currentNow * 1000).toISOString(),
          updated_at: new Date(currentNow * 1000).toISOString(),
        }, { onConflict: 'market_id' })
      }

      setStatus('Market resolved')
      await syncSingleMarketFromChain(marketId)
      await waitForResolvedInSupabase(marketId)
      await loadMarkets()
    } catch (error) {
      console.error(error)
      setStatus(error?.shortMessage || error?.message || 'Resolve failed')
    } finally {
      setIsBusy(false)
    }
  }

  const handleClaim = async (marketId) => {
    if (!isConnected) return alert('Please connect wallet')
    try {
      setIsBusy(true)
      setStatus('Claiming payout...')
      const hash = await writeContractAsync({
        address: TUG_OF_WAR_ADDRESS,
        abi: TUG_OF_WAR_ABI,
        functionName: 'claim',
        args: [BigInt(marketId)],
        dataSuffix: DATA_SUFFIX, // ERC-8021 Builder Code attribution (Base)
      })
      const receipt = await waitForTx(hash)
      const market = markets.find((m) => m.id === marketId)
      const payout = market?.claimable ? market.claimable.toString() : '0'
      if (supabase?.from) {
        await supabase.from(TOW_TABLES.CLAIMS).insert({
          market_id: marketId,
          user_address: address?.toLowerCase(),
          payout_wei: payout,
          tx_hash: hash,
          created_at: new Date().toISOString(),
        })
        if (receipt?.blockNumber) {
          await supabase.from(TOW_TABLES.MARKETS).upsert({
            market_id: marketId,
            contract_address: TUG_OF_WAR_ADDRESS.toLowerCase(),
            chain_id: 8453,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'market_id' })
        }
      }
      setStatus('Claim successful')
      await syncMarketsFromChain(true)
      await loadMarkets()
    } catch (error) {
      console.error(error)
      setStatus(error?.shortMessage || error?.message || 'Claim failed')
    } finally {
      setIsBusy(false)
    }
  }

  const { totalClaimable, claimableMarketIds } = useMemo(() => {
    const ids = markets.filter((m) => m.resolved && (m.claimable || 0n) > 0n).map((m) => m.id)
    const total = ids.reduce((sum, id) => {
      const m = markets.find((x) => x.id === id)
      return sum + (m?.claimable || 0n)
    }, 0n)
    return { totalClaimable: total, claimableMarketIds: ids }
  }, [markets])

  const handleClaimAll = async () => {
    if (!isConnected || claimableMarketIds.length === 0) return
    try {
      setIsBusy(true)
      const total = claimableMarketIds.length
      for (let i = 0; i < total; i += 1) {
        const marketId = claimableMarketIds[i]
        setStatus(`Claiming ${i + 1}/${total}...`)
        const hash = await writeContractAsync({
          address: TUG_OF_WAR_ADDRESS,
          abi: TUG_OF_WAR_ABI,
          functionName: 'claim',
          args: [BigInt(marketId)],
          dataSuffix: DATA_SUFFIX,
        })
        await waitForTx(hash)
        const market = markets.find((m) => m.id === marketId)
        const payout = market?.claimable ? market.claimable.toString() : '0'
        if (supabase?.from) {
          await supabase.from(TOW_TABLES.CLAIMS).insert({
            market_id: marketId,
            user_address: address?.toLowerCase(),
            payout_wei: payout,
            tx_hash: hash,
            created_at: new Date().toISOString(),
          })
        }
      }
      setStatus(`Claimed ${total} payout(s)`)
      await syncMarketsFromChain(true)
      await loadMarkets()
    } catch (error) {
      console.error(error)
      setStatus(error?.shortMessage || error?.message || 'Claim failed')
    } finally {
      setIsBusy(false)
    }
  }

  const unresolvedMarkets = useMemo(
    () => markets.filter((m) => !m.resolved && !(m.endTime <= now && (m.totalYes + m.totalNo) === 0n)),
    [markets, now]
  )
  const noContestMarkets = useMemo(
    () => markets.filter((m) => !m.resolved && m.endTime <= now && (m.totalYes + m.totalNo) === 0n),
    [markets, now]
  )
  const resolvedMarkets = useMemo(
    () => markets.filter((m) => m.resolved),
    [markets]
  )
  const currentMarketList = useMemo(() => {
    if (marketView === 'finished') return [...resolvedMarkets, ...noContestMarkets]
    return unresolvedMarkets
  }, [marketView, unresolvedMarkets, resolvedMarkets, noContestMarkets])
  const currentMarketTitle = useMemo(() => {
    if (marketView === 'finished') return 'Resolved'
    return 'Predictions'
  }, [marketView])
  const sortedMarketList = useMemo(() => {
    const list = [...currentMarketList]
    if (marketSort === 'oldest') {
      return list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    }
    if (marketSort === 'volume') {
      return list.sort((a, b) => {
        const av = a.totalYes + a.totalNo
        const bv = b.totalYes + b.totalNo
        if (av === bv) return 0
        return av > bv ? -1 : 1
      })
    }
    if (marketSort === 'participants') {
      return list.sort((a, b) => (b.participantCount || 0) - (a.participantCount || 0))
    }
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [currentMarketList, marketSort])

  const TabBtn = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1,
        padding: '12px 16px',
        background: activeTab === id ? 'rgba(59,130,246,0.15)' : 'transparent',
        border: 'none',
        borderBottom: activeTab === id ? '2px solid #3b82f6' : '2px solid transparent',
        color: activeTab === id ? '#93c5fd' : '#6b7280',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  )
  const MarketFilterBtn = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setMarketView(id)}
      style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: marketView === id ? 'rgba(59,130,246,0.2)' : 'rgba(30, 41, 59, 0.6)',
        color: marketView === id ? '#bfdbfe' : '#9ca3af',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
  const SortBtn = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setMarketSort(id)}
      style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: marketSort === id ? 'rgba(34,197,94,0.15)' : 'rgba(30, 41, 59, 0.6)',
        color: marketSort === id ? '#bbf7d0' : '#9ca3af',
        borderRadius: '8px',
        padding: '7px 11px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  const renderMarketCard = (market) => {
    const totalPool = market.totalYes + market.totalNo
    const yesPct = totalPool > 0n ? Number((market.totalYes * 10000n) / totalPool) / 100 : 0
    const noPct = totalPool > 0n ? Number((market.totalNo * 10000n) / totalPool) / 100 : 0
    const remaining = market.endTime - now
    const isEnded = remaining <= 0
    const isNoContest = !market.resolved && isEnded && totalPool === 0n
    const isBetLocked = !market.resolved && remaining <= Number(lockWindowSeconds || 0)
    const canResolve = !market.resolved && isEnded && !isNoContest
    const needsResolve = !market.resolved && isEnded && !isNoContest
    const marketStatus = getMarketStatus(market)
    const isTie = market.winningSide === 3
    const isYesWinner = market.winningSide === 1
    const winnerLabel = isTie ? 'Tie (Refund)' : (isYesWinner ? 'YES WON' : 'NO WON')
    const canClaim = market.resolved && market.claimable > 0n && !isBusy
    const winningStake = market.resolved
      ? (isTie ? (market.yesStake || 0n) + (market.noStake || 0n) : (isYesWinner ? (market.yesStake || 0n) : (market.noStake || 0n)))
      : 0n
    const losingStake = market.resolved && !isTie ? (isYesWinner ? (market.noStake || 0n) : (market.yesStake || 0n)) : 0n
    const totalYourStake = (market.yesStake || 0n) + (market.noStake || 0n)
    const netAfterClaim = market.resolved ? ((market.claimable || 0n) - totalYourStake) : 0n

    return (
      <div id={`market-${market.id}`} key={market.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
          <strong
            style={{
              color: '#f8fafc',
              fontSize: '35px',
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: '-0.2px',
              display: 'block',
              marginRight: '8px',
            }}
          >
            {formatMarketTitle(market.question)}
          </strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={getMarketShareIntentUrl(market)}
              target="_blank"
              rel="noopener noreferrer"
              title="Share this market on X (Twitter)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '999px',
                background: '#0b0b0b',
                border: '1px solid #2a2a2a',
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 500,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span style={{ color: '#e2e8f0' }}>Share</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>X</span>
            </a>
            <span style={{ color: market.resolved ? '#10b981' : isNoContest ? '#fbbf24' : isEnded ? '#fca5a5' : '#93c5fd', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {market.resolved ? 'Resolved' : isNoContest ? 'Void' : isEnded ? 'Pending' : formatCountdown(Math.max(remaining, 0))}
            </span>
          </div>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '10px' }}>
          Creator: {formatShortAddress(market.creator)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}><span style={{ color: '#64748b' }}>Participants</span> <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{market.participantCount || 0}</span></span>
          <span style={{ color: '#64748b', fontSize: '14px' }}>·</span>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}><span style={{ color: '#64748b' }}>Bets</span> <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{market.totalBetCount || 0}</span></span>
          <span style={{ color: '#64748b', fontSize: '14px' }}>·</span>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}><span style={{ color: '#64748b' }}>Volume</span> <span style={{ color: '#22d3ee', fontWeight: 600 }}>{formatEth(market.totalYes + market.totalNo)} ETH</span></span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ color: '#10b981', fontWeight: 800, fontSize: '17px', marginBottom: '4px' }}>YES {yesPct.toFixed(2)}%</div>
            <div style={{ color: '#a7f3d0', fontSize: '15px', fontWeight: 600 }}>{formatEth(market.totalYes)} ETH</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '17px', marginBottom: '4px' }}>NO {noPct.toFixed(2)}%</div>
            <div style={{ color: '#fecaca', fontSize: '15px', fontWeight: 600 }}>{formatEth(market.totalNo)} ETH</div>
          </div>
        </div>

        {market.isWarning && (
          <div style={{ marginBottom: '10px', color: '#fbbf24', fontSize: '13px', fontWeight: 500 }}>
            One side dominates ({(Number(market.imbalanceBps) / 100).toFixed(0)}% of pool).
          </div>
        )}

        {(market.resolved || marketStatus === 'expired') && (
          <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            {isNoContest ? (
              <>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Result</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '13px',
                    color: '#422006',
                    background: '#fcd34d',
                    border: '1px solid #f59e0b',
                  }}
                >
                  Void
                </span>
                <span style={{ color: '#64748b', fontSize: '14px' }}>Pool 0.0000 ETH</span>
              </>
            ) : market.resolved ? (
              <>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Result</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '13px',
                    color: isTie ? '#422006' : (isYesWinner ? '#052e16' : '#450a0a'),
                    background: isTie ? '#fcd34d' : (isYesWinner ? '#86efac' : '#fca5a5'),
                    border: `1px solid ${isTie ? '#f59e0b' : (isYesWinner ? '#4ade80' : '#f87171')}`,
                  }}
                >
                  {winnerLabel}
                </span>
                <span style={{ color: '#64748b', fontSize: '14px' }}>Pool <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{formatEth(totalPool)} ETH</span></span>
                <span style={{ color: '#64748b', fontSize: '14px' }}>Fee <span style={{ color: '#94a3b8' }}>{formatEth(market.feeAmount)} ETH</span></span>
              </>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Outcome pending · Pool {formatEth(totalPool)} ETH</span>
            )}
          </div>
        )}

        {!market.resolved && marketStatus === 'active' && (
          <div style={{ marginBottom: '10px', color: '#94a3b8', fontSize: '14px' }}>
            {isBetLocked ? 'Bets closed' : 'Accepting bets'}
          </div>
        )}
        {needsResolve && (
          <div
            style={{
              marginBottom: '10px',
              color: '#fde68a',
              fontSize: '12px',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            Market ended. Anyone can resolve to set the outcome.
          </div>
        )}
        {isNoContest && (
          <div
            style={{
              marginBottom: '10px',
              color: '#fcd34d',
              fontSize: '12px',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            No bets placed. Market is void.
          </div>
        )}

        <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
          <span><span style={{ color: '#64748b' }}>YES</span> <span style={{ color: '#34d399', fontWeight: 600 }}>{formatEth(market.yesStake)} ETH</span></span>
          <span style={{ color: '#475569' }}>·</span>
          <span><span style={{ color: '#64748b' }}>NO</span> <span style={{ color: '#f87171', fontWeight: 600 }}>{formatEth(market.noStake)} ETH</span></span>
          {market.claimable > 0n && (
            <>
              <span style={{ color: '#475569' }}>·</span>
              <span><span style={{ color: '#a78bfa', fontWeight: 700 }}>To claim: {formatEth(market.claimable)} ETH</span></span>
            </>
          )}
        </div>
        {market.resolved && (
          <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            {isTie ? (
              <>
                <span><span style={{ color: '#64748b' }}>Refund</span> <span style={{ color: '#94a3b8', fontWeight: 600 }}>{formatEth(winningStake)} ETH</span></span>
                <span style={{ color: '#475569' }}>·</span>
                <span><span style={{ color: '#64748b' }}>Net</span> <span style={{ color: netAfterClaim >= 0n ? '#22c55e' : '#f87171', fontWeight: 700 }}>{netAfterClaim >= 0n ? '' : '-'}{formatEth(netAfterClaim < 0n ? -netAfterClaim : netAfterClaim)} ETH</span></span>
              </>
            ) : (
              <>
                <span><span style={{ color: '#64748b' }}>Winning</span> <span style={{ color: '#34d399', fontWeight: 600 }}>{formatEth(winningStake)} ETH</span></span>
                <span style={{ color: '#475569' }}>·</span>
                <span><span style={{ color: '#64748b' }}>Losing</span> <span style={{ color: '#94a3b8', fontWeight: 500 }}>{formatEth(losingStake)} ETH</span></span>
                <span style={{ color: '#475569' }}>·</span>
                <span><span style={{ color: '#64748b' }}>Net</span> <span style={{ color: netAfterClaim >= 0n ? '#22c55e' : '#f87171', fontWeight: 700 }}>{netAfterClaim >= 0n ? '+' : ''}{formatEth(netAfterClaim)} ETH</span></span>
              </>
            )}
          </div>
        )}

        {!market.resolved && !isBetLocked && !isEnded && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              placeholder="ETH amount"
              value={betInputs[market.id] || ''}
              onChange={(e) => setBetInputs((prev) => ({ ...prev, [market.id]: e.target.value }))}
              style={{
                flex: 1,
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                borderRadius: '12px',
                padding: '10px',
              }}
            />
            <button
              type="button"
              onClick={() => handleBet(market.id, true)}
              disabled={isBusy}
              style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(5, 150, 105, 0.15)', color: '#34d399', borderRadius: '10px', padding: '0 14px', fontWeight: 700, cursor: 'pointer' }}
            >
              YES
            </button>
            <button
              type="button"
              onClick={() => handleBet(market.id, false)}
              disabled={isBusy}
              style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(220, 38, 38, 0.15)', color: '#f87171', borderRadius: '10px', padding: '0 14px', fontWeight: 700, cursor: 'pointer' }}
            >
              NO
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canResolve && (
            <button
              onClick={() => handleResolve(market.id)}
              disabled={isBusy}
              style={{
                border: 'none',
                background: '#2563eb',
                color: 'white',
                borderRadius: '8px',
                padding: '9px 12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Resolve
            </button>
          )}
          {market.resolved && (
            <button
              onClick={() => canClaim && handleClaim(market.id)}
              disabled={!canClaim}
              style={{
                border: 'none',
                background: canClaim ? '#7c3aed' : 'rgba(255, 255, 255, 0.08)',
                color: canClaim ? 'white' : '#cbd5e1',
                borderRadius: '8px',
                padding: '9px 12px',
                fontWeight: 700,
                cursor: canClaim ? 'pointer' : 'not-allowed',
                opacity: canClaim ? 1 : 0.8,
              }}
            >
              {canClaim ? `Claim ${formatEth(market.claimable)} ETH` : 'Nothing to claim'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning>
      <EmbedMeta
        title="Prediction Arena"
        description="Yes/no ETH prediction markets. Larger pool at close wins."
        url={getFarcasterUniversalLink('/prediction-arena')}
        buttonText="Prediction Arena"
      />
      <div className="container" style={{ paddingBottom: '120px' }}>
        <BackButton />

        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <h1 style={{ color: '#e5e7eb', margin: 0 }}>Prediction Arena</h1>
            <span style={{ background: '#f59e0b', color: '#422006', fontWeight: 700, fontSize: '11px', padding: '4px 10px', borderRadius: '999px', letterSpacing: '0.5px' }}>BETA</span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            The side with more ETH in the pool when the market closes wins. No oracle.
          </p>
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '10px', color: '#fca5a5', fontSize: '13px' }}>
            Staking is risky — you can lose your full stake. Only stake what you can afford to lose.
          </div>
          <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ padding: '6px 10px', borderRadius: '8px', background: '#1e293b', color: '#cbd5e1', fontSize: '12px' }}>
              Listing: {createFeeEth ? `${formatEther(createFeeEth)} ETH` : '...'}
            </span>
            <span style={{ padding: '6px 10px', borderRadius: '8px', background: '#1e293b', color: '#cbd5e1', fontSize: '12px' }}>
              Fee: {platformFeeBps ? `${Number(platformFeeBps) / 100}%` : '...'}
            </span>
            <span style={{ padding: '6px 10px', borderRadius: '8px', background: '#1e293b', color: '#cbd5e1', fontSize: '12px' }}>
              Max per side: {maxBetPerUser ? `${formatEther(maxBetPerUser)} ETH` : '...'}
            </span>
            <span style={{ padding: '6px 10px', borderRadius: '8px', background: '#1e293b', color: '#cbd5e1', fontSize: '12px' }}>
              Lock: {lockWindowSeconds ? `${Math.floor(Number(lockWindowSeconds) / 60)} min` : '...'}
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(55,65,81,0.5)',
          marginBottom: '20px',
        }}>
          <TabBtn id="markets" label={`Markets (${markets.length})`} />
          <TabBtn id="create" label="New market" />
        </div>

        {activeTab === 'markets' && totalClaimable > 0n && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              padding: '12px 14px',
              marginBottom: '16px',
              background: 'linear-gradient(90deg, rgba(124,58,237,0.2), rgba(139,92,246,0.15))',
              border: '1px solid rgba(124,58,237,0.4)',
              borderRadius: '12px',
              boxShadow: '0 2px 12px rgba(124,58,237,0.15)',
            }}
          >
            <span style={{ color: '#e9d5ff', fontWeight: 700, fontSize: '15px' }}>
              Available to claim: {formatEth(totalClaimable)} ETH
              {claimableMarketIds.length > 1 && ` (${claimableMarketIds.length} markets)`}
            </span>
            <button
              type="button"
              onClick={handleClaimAll}
              disabled={isBusy}
              style={{
                border: 'none',
                background: isBusy ? '#6b7280' : '#7c3aed',
                color: 'white',
                borderRadius: '10px',
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.8 : 1,
              }}
            >
              {isBusy ? status || 'Claiming...' : `Claim ${formatEth(totalClaimable)} ETH`}
            </button>
          </div>
        )}

        {activeTab === 'create' && (
          <div style={{
            background: 'linear-gradient(145deg, rgba(15,23,42,0.98), rgba(30,41,59,0.92))',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 8px 28px rgba(15,23,42,0.35)',
            width: 'min(920px, 100%)',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ color: '#e2e8f0', marginTop: 0, marginBottom: 0 }}>New market</h3>
              <button
                type="button"
                onClick={() => setActiveTab('markets')}
                style={{
                  border: '1px solid #334155',
                  background: 'rgba(30, 41, 59, 0.6)',
                  color: '#cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            </div>
            <p style={{ marginTop: '8px', marginBottom: '12px', color: '#93a3b8', fontSize: '13px' }}>
              Create a yes/no market. The side with the larger pool at close wins.
            </p>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will BaseHub add feature X this week?"
              maxLength={200}
              style={{
                width: '100%',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                borderRadius: '12px',
                padding: '14px 12px',
                marginBottom: '14px',
                boxSizing: 'border-box',
                fontSize: '18px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {durationOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDurationSeconds(opt.value)}
                  type="button"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: durationSeconds === opt.value ? '#2563eb' : 'rgba(30, 41, 59, 0.6)',
                    color: '#e5e7eb',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleCreateMarket}
              disabled={isBusy}
              style={{
                width: '100%',
                border: 'none',
                background: '#16a34a',
                color: 'white',
                borderRadius: '10px',
                padding: '14px',
                fontWeight: 700,
                fontSize: '18px',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.7 : 1,
              }}
            >
              {isBusy ? 'Creating...' : `Create market (${createFeeEth ? formatEther(createFeeEth) : '0.001'} ETH)`}
            </button>
          </div>
        )}

        {status && (
          <div style={{ marginBottom: '14px', color: '#93c5fd', fontSize: '13px' }}>
            {status}
          </div>
        )}
        {isSyncing && (
          <div style={{ marginBottom: '14px', color: '#22c55e', fontSize: '12px' }}>
            Syncing on-chain snapshot to Supabase...
          </div>
        )}

        {activeTab === 'markets' && (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={async () => {
                  await syncMarketsFromChain(true)
                  await loadMarkets()
                }}
                disabled={isBusy}
                style={{
                  border: '1px solid #334155',
                  background: 'rgba(30, 41, 59, 0.6)',
                  color: '#cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <MarketFilterBtn id="predictions" label={`Predictions (${unresolvedMarkets.length})`} />
              <MarketFilterBtn id="finished" label={`Finished (${resolvedMarkets.length + noContestMarkets.length})`} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <SortBtn id="newest" label="Newest" />
              <SortBtn id="oldest" label="Oldest" />
              <SortBtn id="volume" label="Highest Volume" />
              <SortBtn id="participants" label="Most Participants" />
            </div>

            <div>
              <h3 style={{ color: '#e2e8f0', marginBottom: '10px' }}>{currentMarketTitle}</h3>
              {sortedMarketList.length ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {sortedMarketList.map(renderMarketCard)}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  {marketView === 'predictions' && 'No active markets.'}
                  {marketView === 'finished' && 'No resolved markets.'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'markets' && markets.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '20px' }}>
            No markets yet. Create one above.
          </div>
        )}
      </div>
    </NetworkGuard>
  )
}

export default PredictionArena
