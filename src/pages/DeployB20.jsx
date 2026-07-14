import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAccount, useBalance, useChainId, useReadContract, useSwitchChain } from 'wagmi'
import { formatEther, formatUnits, parseAbiItem, parseUnits } from 'viem'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  Image,
  LineChart,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Star,
  Upload,
  ShieldCheck,
  Zap,
  Wallet,
} from 'lucide-react'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import { Helmet } from 'react-helmet-async'
import BackButton from '../components/BackButton'
import { LaunchpadProgress, LaunchpadStatStrip, LaunchpadTrustStrip, TokenGridSkeleton } from '../components/LaunchpadPrimitives'
import { useDeployB20 } from '../hooks/useDeployB20'
import { useB20Launchpad } from '../hooks/useB20Launchpad'
import { uploadToIPFS } from '../utils/pinata'
import { getTransactionExplorerUrl, NETWORKS } from '../config/networks'
import { supabase } from '../config/supabase'
import { getReadClient } from '../utils/readClient'
import { DEFAULT_ETH_USD_PRICE, useEthUsdPrice } from '../hooks/useEthUsdPrice'
import {
  B20_CURVE_CREATE_FEE_ETH,
  B20_CURVE_GRADUATION_ETH,
  B20_CURVE_TOTAL_SUPPLY,
  B20_CURVE_TRADING_FEE_BPS,
  B20_DEPLOY_FEE_ETH,
  B20_VARIANTS,
  B20_XP_REWARD,
  BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
  B20_CURVE_ERC20_ABI,
  getB20LauncherAddress,
} from '../config/b20'

const B20_LOGO_SRC = '/crypto-logos/basahub logo/B20.svg'
const B20_PUBLIC_SOON = false
const B20_CACHE_PREFIX = 'basehub:b20:curve-tokens'
const B20_SUPABASE_TABLE = 'b20_tokens'
const initialNormalForm = {
  variant: 'asset',
  name: '',
  symbol: '',
  decimals: 18,
  supplyCap: '1000000000',
  initialMint: '',
  currency: 'USD',
}

const initialCurveForm = {
  name: '',
  symbol: '',
  description: '',
  image: '',
  creatorAllocationBps: 0,
}

const responsiveCss = `
.b20-page button:disabled,
.b20-page label:has(input:disabled) {
  opacity: 0.55;
  cursor: not-allowed !important;
}

@media (max-width: 920px) {
  .b20-hero,
  .b20-content-grid,
  .b20-market-grid {
    grid-template-columns: 1fr !important;
  }

  .b20-two-col,
  .b20-market-stats,
  .b20-launch-facts,
  .b20-platform-stats,
  .b20-token-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .b20-browser-controls {
    grid-template-columns: 1fr !important;
  }

  .b20-status-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    border-left: 0 !important;
    border-top: 1px solid rgba(148, 163, 184, 0.14) !important;
  }

  .b20-notice,
  .b20-feedback {
    align-items: flex-start !important;
    flex-wrap: wrap !important;
  }

  .b20-small-button,
  .b20-feedback-link {
    margin-left: 0 !important;
  }
}

@media (max-width: 560px) {
  .b20-page {
    padding: 18px 12px 48px !important;
  }

  .b20-title {
    font-size: 32px !important;
  }

  .b20-two-col,
  .b20-market-stats,
  .b20-launch-facts,
  .b20-platform-stats,
  .b20-token-grid,
  .b20-segmented {
    grid-template-columns: 1fr !important;
  }

  .b20-logo-uploader {
    grid-template-columns: 48px minmax(0, 1fr) !important;
  }

  .b20-logo-uploader label {
    grid-column: 1 / -1;
  }
}
`

function shortAddress(address) {
  if (!address) return '-'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function transactionErrorStatus(error, fallback) {
  return {
    type: error?.isSubmitted ? 'pending' : 'error',
    text: error?.shortMessage || error?.message || fallback,
    txHash: error?.txHash || null,
  }
}

function formatNumber(value, maximumFractionDigits = 2) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0'
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(2)}B`
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`
  if (number >= 1_000) return `${(number / 1_000).toFixed(2)}K`
  return number.toLocaleString(undefined, { maximumFractionDigits })
}

function b20CacheKey(chainId, launchpadAddress) {
  return `${B20_CACHE_PREFIX}:${Number(chainId || 0)}:${String(launchpadAddress || '').toLowerCase()}`
}

function stringifyBigInt(value) {
  return typeof value === 'bigint' ? value.toString() : value
}

function serializeB20Token(token) {
  return JSON.parse(JSON.stringify(token, (_, value) => stringifyBigInt(value)))
}

function reviveB20Token(token) {
  if (!token) return null
  const reviveBigInt = (value) => {
    try {
      return BigInt(value || 0)
    } catch {
      return 0n
    }
  }
  return {
    ...token,
    core: token.core ? {
      ...token.core,
      virtualETH: reviveBigInt(token.core.virtualETH),
      virtualTokens: reviveBigInt(token.core.virtualTokens),
      realETH: reviveBigInt(token.core.realETH),
      creatorAllocation: reviveBigInt(token.core.creatorAllocation),
      createdAt: reviveBigInt(token.core.createdAt),
      graduated: Boolean(token.core.graduated),
    } : token.core,
    stats: token.stats ? {
      ...token.stats,
      buys: reviveBigInt(token.stats.buys),
      sells: reviveBigInt(token.stats.sells),
      volume: reviveBigInt(token.stats.volume),
      holders: reviveBigInt(token.stats.holders),
      graduatedAt: reviveBigInt(token.stats.graduatedAt),
    } : token.stats,
    createdAtMs: Number(token.createdAtMs || 0),
  }
}

function b20TokenFromRow(row) {
  if (!row?.token_address) return null
  const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : 0
  const realETH = parseEther(normalizeDecimalInput(row.real_eth || '0', 18) || '0')
  const virtualETH = parseEther(normalizeDecimalInput(row.virtual_eth || '1', 18) || '1')
  const virtualTokens = parseUnits(normalizeDecimalInput(row.virtual_tokens || '0', 18) || '0', 18)
  const volume = parseEther(normalizeDecimalInput(row.total_volume || '0', 18) || '0')
  return {
    address: row.token_address,
    name: row.name || 'B20 Token',
    symbol: row.symbol || 'B20',
    description: row.description || '',
    image: row.image_uri || '',
    core: {
      creator: row.creator || '',
      virtualETH,
      virtualTokens,
      realETH,
      creatorAllocation: BigInt(row.creator_allocation || 0),
      createdAt: BigInt(createdAtMs > 0 ? Math.floor(createdAtMs / 1000) : 0),
      pair: row.uniswap_pair || undefined,
      graduated: Boolean(row.graduated),
    },
    stats: {
      buys: BigInt(row.total_buys || 0),
      sells: BigInt(row.total_sells || 0),
      volume,
      holders: BigInt(row.holder_count || 0),
      graduatedAt: BigInt(row.graduated_at || 0),
    },
    progress: Number(row.progress || 0),
    realEthLabel: String(row.real_eth || '0'),
    volumeLabel: String(row.total_volume || '0'),
    holdersLabel: Number(row.holder_count || 0).toLocaleString(),
    createdAtMs,
    _fromSupabase: true,
  }
}

function b20TokenToRow(token, chainId, launchpadAddress) {
  const createdAtMs = Number(token.createdAtMs || 0)
  return {
    token_address: String(token.address || '').toLowerCase(),
    chain_id: Number(chainId || NETWORKS.BASE.chainId),
    launchpad_address: String(launchpadAddress || '').toLowerCase(),
    creator: token.core?.creator ? String(token.core.creator).toLowerCase() : null,
    name: token.name || 'B20 Token',
    symbol: token.symbol || 'B20',
    description: token.description || '',
    image_uri: token.image || '',
    creator_allocation: Number(token.core?.creatorAllocation || 0n),
    virtual_eth: formatEther(token.core?.virtualETH || 0n),
    virtual_tokens: formatUnits(token.core?.virtualTokens || 0n, 18),
    real_eth: formatEther(token.core?.realETH || 0n),
    graduated: Boolean(token.core?.graduated),
    uniswap_pair: token.core?.pair || null,
    progress: Number(token.progress || 0),
    total_buys: Number(token.stats?.buys || 0n),
    total_sells: Number(token.stats?.sells || 0n),
    total_volume: formatEther(token.stats?.volume || 0n),
    holder_count: Number(token.stats?.holders || 0n),
    graduated_at: Number(token.stats?.graduatedAt || 0n),
    created_at: createdAtMs > 0 ? new Date(createdAtMs).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function readSupabaseB20Tokens(chainId, launchpadAddress) {
  if (!supabase?.from || !launchpadAddress) return []
  try {
    const { data, error } = await supabase
      .from(B20_SUPABASE_TABLE)
      .select('token_address,chain_id,launchpad_address,creator,name,symbol,description,image_uri,creator_allocation,virtual_eth,virtual_tokens,real_eth,graduated,uniswap_pair,progress,total_buys,total_sells,total_volume,holder_count,graduated_at,created_at,updated_at')
      .eq('chain_id', Number(chainId || NETWORKS.BASE.chainId))
      .eq('launchpad_address', String(launchpadAddress).toLowerCase())
      .order('created_at', { ascending: false })
      .limit(500)
    if (error || !Array.isArray(data)) return []
    return data.map((row) => {
      try {
        return b20TokenFromRow(row)
      } catch {
        return null
      }
    }).filter(Boolean)
  } catch {
    return []
  }
}

async function upsertSupabaseB20Tokens(chainId, launchpadAddress, tokens) {
  if (!supabase?.from || !launchpadAddress || !Array.isArray(tokens) || tokens.length === 0) return
  try {
    await supabase
      .from(B20_SUPABASE_TABLE)
      .upsert(tokens.map((token) => b20TokenToRow(token, chainId, launchpadAddress)), { onConflict: 'token_address' })
  } catch {
    /* Supabase cache is best-effort. */
  }
}

function readCachedB20Tokens(chainId, launchpadAddress) {
  if (typeof window === 'undefined' || !window.localStorage || !launchpadAddress) return []
  try {
    const raw = window.localStorage.getItem(b20CacheKey(chainId, launchpadAddress))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.tokens)) return []
    return parsed.tokens.map(reviveB20Token).filter(Boolean)
  } catch {
    return []
  }
}

function writeCachedB20Tokens(chainId, launchpadAddress, tokens) {
  if (typeof window === 'undefined' || !window.localStorage || !launchpadAddress || !Array.isArray(tokens)) return
  try {
    window.localStorage.setItem(b20CacheKey(chainId, launchpadAddress), JSON.stringify({
      updatedAt: Date.now(),
      tokens: tokens.map(serializeB20Token),
    }))
  } catch {
    /* ignore cache failures */
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function settleWithin(promise, timeoutMs, fallback = []) {
  return Promise.race([
    promise,
    sleep(timeoutMs).then(() => fallback),
  ]).catch(() => fallback)
}

async function withRetry(fn, { attempts = 3, delayMs = 500 } = {}) {
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

function normalizeDecimalInput(value, decimals = 18) {
  let text = String(value ?? '').trim().replace(/\s/g, '')
  if (!text) return ''

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
  const [whole = '', ...fractionParts] = text.split('.')
  const fraction = fractionParts.join('').slice(0, decimals)
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '')
  if (text.includes('.') && fraction.length >= 0) return `${normalizedWhole || '0'}.${fraction}`
  return normalizedWhole
}

function parseTokenAmountSafe(value) {
  try {
    const normalized = normalizeDecimalInput(value, 18)
    return normalized ? parseUnits(normalized, 18) : 0n
  } catch {
    return 0n
  }
}

function formatTokenInput(rawAmount, decimals = 6) {
  const formatted = formatUnits(rawAmount > 0n ? rawAmount : 0n, 18)
  const [whole, fraction = ''] = formatted.split('.')
  const trimmedFraction = fraction.slice(0, decimals).replace(/0+$/, '')
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

function getCurveSellableAmount(token, balanceRaw) {
  if (!token?.core || token.core.graduated) return balanceRaw
  const realETH = token.core.realETH || 0n
  const virtualETH = token.core.virtualETH || 0n
  const virtualTokens = token.core.virtualTokens || 0n
  if (realETH <= 0n || virtualTokens <= 0n) return 0n
  if (virtualETH <= realETH) return balanceRaw

  const maxByLiquidity = (realETH * virtualTokens) / (virtualETH - realETH)
  const conservativeMax = (maxByLiquidity * 995n) / 1000n
  return conservativeMax < balanceRaw ? conservativeMax : balanceRaw
}

function timeAgo(timestamp) {
  if (!timestamp) return '-'
  const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatMarketCap(value) {
  if (!value || value <= 0) return '$0'
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function tokenMarketCapUSD(token, ethPriceUsd = DEFAULT_ETH_USD_PRICE) {
  const virtual = Number(token?.realEthLabel || 0) + 1
  return virtual * ethPriceUsd
}

function tokenTxCount(token) {
  return Number(token?.stats?.buys || 0n) + Number(token?.stats?.sells || 0n)
}

function b20TrendScore(token) {
  const volume = Number(token?.volumeLabel || 0)
  const txns = tokenTxCount(token)
  const progress = Number(token?.progress || 0)
  return (volume * 1000) + (txns * 3) + progress
}

function isTrendingB20Token(token) {
  return b20TrendScore(token) > 0 && (Number(token?.volumeLabel || 0) >= 0.001 || tokenTxCount(token) >= 3 || Number(token?.progress || 0) > 0)
}

function modeCopy(mode) {
  if (mode === 'curve') {
    return 'Bonding curve, live markets, creator fees.'
  }
  return 'Create a B20 asset or stablecoin directly.'
}

function B20SoonPage() {
  return (
    <>
      <Helmet>
        <title>B20 Launchpad Coming Soon - BaseHub</title>
        <meta
          name="description"
          content="B20 Launchpad is preparing for mainnet. Public launch and trading will open after mainnet contracts are deployed."
        />
      </Helmet>
      <style>{responsiveCss}</style>
      <main className="b20-page" style={styles.page}>
        <div style={styles.backRow}>
          <BackButton />
        </div>
        <section className="b20-soon-hero" style={styles.soonHero}>
          <div style={styles.soonBrand}>
            <img src={B20_LOGO_SRC} alt="B20" style={styles.soonLogo} />
            <div>
              <p style={styles.eyebrow}>Base-native token launches</p>
              <h1 className="b20-title" style={styles.soonTitle}>B20 Launchpad is coming soon</h1>
            </div>
          </div>
          <p style={styles.soonCopy}>
            Public B20 launches and curve markets are temporarily closed while we prepare the mainnet release.
            New contracts will be deployed and verified when B20 mainnet activation is ready.
          </p>
          <div className="b20-platform-stats" style={styles.soonGrid}>
            <Metric label="Status" value="Soon" tone="warn" />
            <Metric label="Network" value="Mainnet next" tone="good" />
            <Metric label="Launch" value="Closed" tone="warn" />
            <Metric label="Trading" value="Closed" tone="warn" />
          </div>
        </section>
      </main>
    </>
  )
}

export default function DeployB20() {
  if (B20_PUBLIC_SOON) return <B20SoonPage />

  const [searchParams] = useSearchParams()
  const { address } = useAccount()
  const { price: ethPriceUsd } = useEthUsdPrice()
  const chainId = useChainId()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()
  const [mode, setMode] = useState('curve')
  const [activeTab, setActiveTab] = useState('tokens')
  const [normalForm, setNormalForm] = useState(initialNormalForm)
  const [curveForm, setCurveForm] = useState(initialCurveForm)
  const [tokens, setTokens] = useState([])
  const [selectedToken, setSelectedToken] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState(null)
  const [activation, setActivation] = useState({ asset: null, stablecoin: null })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const tokenLoadRequestRef = useRef(0)

  const { deployB20, readActivation, isLoading: normalLoading, error: normalError } = useDeployB20()
  const {
    launchpadAddress,
    dataChainId,
    isSupported,
    isTestnet,
    isLoading: curveLoading,
    error: curveError,
    fetchTokens,
    createCurveToken,
    buyTokens,
    sellTokens,
    claimFees,
    formatTokenAmount,
  } = useB20Launchpad()

  const activeNetworkLabel = useMemo(() => {
    if (Number(chainId) === NETWORKS.BASE_SEPOLIA.chainId) return 'Base Sepolia'
    if (Number(chainId) === NETWORKS.BASE.chainId) return 'Base'
    return 'Unsupported network'
  }, [chainId])

  const normalLauncherAddress = useMemo(() => getB20LauncherAddress(chainId), [chainId])
  const isBusy = normalLoading || curveLoading || isSwitching
  const needsBaseNetworkForCurve = !launchpadAddress && !isSupported
  const platformStats = useMemo(() => {
    const totalVolume = tokens.reduce((sum, token) => sum + Number(token.volumeLabel || 0), 0)
    return {
      totalTokens: tokens.length,
      graduated: tokens.filter((token) => token.core?.graduated).length,
      totalVolumeETH: totalVolume,
      tradingFee: `${B20_CURVE_TRADING_FEE_BPS / 100}%`,
    }
  }, [tokens])

  const filteredTokens = useMemo(() => {
    let result = [...tokens]
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter((token) =>
        token.name?.toLowerCase().includes(query) ||
        token.symbol?.toLowerCase().includes(query) ||
        token.address?.toLowerCase().includes(query)
      )
    }
    if (category === 'graduated') {
      result = result.filter((token) => token.core?.graduated)
    } else if (category === 'trending') {
      result = result.filter(isTrendingB20Token)
    } else if (category === 'new') {
      const oneDayAgo = Date.now() - 86400000
      result = result.filter((token) => Number(token.createdAtMs || 0) > oneDayAgo)
    }
    switch (sortBy) {
      case 'volume':
        result.sort((a, b) => Number(b.volumeLabel || 0) - Number(a.volumeLabel || 0))
        break
      case 'marketcap':
        result.sort((a, b) => tokenMarketCapUSD(b, ethPriceUsd) - tokenMarketCapUSD(a, ethPriceUsd))
        break
      case 'progress':
        result.sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0))
        break
      default:
        result.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    }
    return result
  }, [category, ethPriceUsd, searchQuery, sortBy, tokens])

  const loadTokens = async ({ forceChainRefresh = false } = {}) => {
    const requestId = ++tokenLoadRequestRef.current
    if (!launchpadAddress) {
      setTokens([])
      setSelectedToken(null)
      return
    }
    const cachedTokens = readCachedB20Tokens(dataChainId, launchpadAddress)
    if (cachedTokens.length > 0) setTokens((current) => current.length > 0 ? current : cachedTokens)
    setIsRefreshing(true)

    const supabasePromise = readSupabaseB20Tokens(dataChainId, launchpadAddress)

    if (!forceChainRefresh) {
      const supabaseTokens = await settleWithin(supabasePromise, 6000)
      if (requestId !== tokenLoadRequestRef.current) return
      if (supabaseTokens.length > 0) {
        setTokens(supabaseTokens)
        writeCachedB20Tokens(dataChainId, launchpadAddress, supabaseTokens)
        setIsRefreshing(false)
        return
      }
      if (cachedTokens.length > 0) {
        setIsRefreshing(false)
        return
      }
    }

    try {
      const nextTokens = await settleWithin(fetchTokens({
        knownTokens: cachedTokens,
        knownTokensPromise: supabasePromise,
        forceRefresh: true,
      }), 25000)
      if (requestId !== tokenLoadRequestRef.current) return
      const supabaseTokens = await settleWithin(supabasePromise, 1000)
      if (nextTokens.length > 0) setTokens(nextTokens)
      else if (cachedTokens.length === 0 && supabaseTokens.length === 0) setTokens([])
      if (nextTokens.length > 0) {
        writeCachedB20Tokens(dataChainId, launchpadAddress, nextTokens)
        upsertSupabaseB20Tokens(dataChainId, launchpadAddress, nextTokens)
      }
      setSelectedToken((current) => {
        if (!nextTokens.length) return null
        if (!current) return null
        return nextTokens.find((item) => String(item.address).toLowerCase() === String(current.address).toLowerCase()) || null
      })
    } catch (err) {
      if (requestId !== tokenLoadRequestRef.current) return
      console.warn('B20 token refresh failed:', err)
      const fallbackTokens = cachedTokens.length > 0 ? cachedTokens : await supabasePromise
      if (fallbackTokens.length > 0) setTokens((current) => current.length > 0 ? current : fallbackTokens)
    } finally {
      if (requestId === tokenLoadRequestRef.current) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    let alive = true
    async function loadActivation() {
      if (!isSupported) {
        setActivation({ asset: null, stablecoin: null })
        return
      }
      try {
        const [asset, stablecoin] = await Promise.all([
          readActivation(B20_VARIANTS.ASSET),
          readActivation(B20_VARIANTS.STABLECOIN),
        ])
        if (alive) setActivation({ asset: Boolean(asset), stablecoin: Boolean(stablecoin) })
      } catch {
        if (alive) setActivation({ asset: null, stablecoin: null })
      }
    }
    loadActivation()
    return () => {
      alive = false
    }
  }, [chainId, isSupported, readActivation])

  useEffect(() => {
    loadTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchpadAddress, dataChainId])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'create' || tab === 'tokens') setActiveTab(tab)
  }, [searchParams])

  const switchToBaseNetwork = async () => {
    await switchChainAsync({ chainId: NETWORKS.BASE.chainId })
  }

  const handleNormalSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)
    try {
      const result = await deployB20(normalForm)
      setStatus({
        type: 'success',
        text: `B20 deployed: ${shortAddress(result.tokenAddress || result.predictedAddress)}${result.xpEarned ? ` • ${result.xpEarned.toLocaleString()} XP` : ''}`,
        txHash: result.txHash,
      })
      setNormalForm(initialNormalForm)
    } catch (err) {
      setStatus(transactionErrorStatus(err, 'B20 deploy failed.'))
    }
  }

  const handleCurveSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)
    if (!curveForm.image) {
      setStatus({ type: 'error', text: 'Upload a token logo first.' })
      return
    }
    try {
      const result = await createCurveToken(curveForm)
      setStatus({
        type: 'success',
        text: `Curve B20 launched: ${shortAddress(result.tokenAddress)}${result.xpEarned ? ` • ${result.xpEarned.toLocaleString()} XP` : ''}`,
        txHash: result.txHash,
      })
      setCurveForm(initialCurveForm)
      setLogoPreview('')
      setActiveTab('tokens')
      if (result.tokenAddress && launchpadAddress) {
        const nowMs = Date.now()
        const creatorAllocation = BigInt(Math.max(0, Math.min(1000, Math.round(Number(curveForm.creatorAllocationBps || 0)))))
        const creatorTokens = (parseUnits('1000000000', 18) * creatorAllocation) / 10000n
        const optimisticToken = {
          address: result.tokenAddress,
          name: curveForm.name,
          symbol: curveForm.symbol,
          description: curveForm.description,
          image: curveForm.image,
          core: {
            creator: address,
            virtualETH: parseEther('1'),
            virtualTokens: parseUnits('1000000000', 18) - creatorTokens,
            realETH: 0n,
            creatorAllocation,
            createdAt: BigInt(Math.floor(nowMs / 1000)),
            pair: undefined,
            graduated: false,
          },
          stats: { buys: 0n, sells: 0n, volume: 0n, holders: 0n, graduatedAt: 0n },
          progress: 0,
          realEthLabel: '0.0000',
          volumeLabel: '0.0000',
          holdersLabel: '0',
          createdAtMs: nowMs,
        }
        setTokens((prev) => {
          const withoutDuplicate = prev.filter((token) => String(token.address).toLowerCase() !== String(result.tokenAddress).toLowerCase())
          const next = [optimisticToken, ...withoutDuplicate]
          writeCachedB20Tokens(chainId, launchpadAddress, next)
          upsertSupabaseB20Tokens(chainId, launchpadAddress, [optimisticToken])
          return next
        })
      }
      await loadTokens({ forceChainRefresh: true })
    } catch (err) {
      setStatus(transactionErrorStatus(err, 'Curve launch failed.'))
    }
  }

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setStatus(null)
    setLogoPreview(URL.createObjectURL(file))
    setIsUploadingLogo(true)
    try {
      const imageUrl = await uploadToIPFS(file)
      setCurveForm((prev) => ({ ...prev, image: imageUrl }))
      setStatus({ type: 'success', text: 'Logo uploaded to IPFS.' })
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Logo upload failed.' })
    } finally {
      setIsUploadingLogo(false)
      event.target.value = ''
    }
  }

  const handleTrade = async (side, amount) => {
    if (!selectedToken) return
    setStatus(null)
    try {
      const result =
        side === 'buy'
          ? await buyTokens(selectedToken.address, amount)
          : await sellTokens(selectedToken.address, amount)
      setStatus({
        type: 'success',
        text: side === 'buy' ? 'Buy confirmed.' : 'Sell confirmed.',
        txHash: result.txHash,
      })
      await loadTokens({ forceChainRefresh: true })
    } catch (err) {
      setStatus(transactionErrorStatus(err, 'Trade failed.'))
    }
  }

  const explorerTx = status?.txHash ? getTransactionExplorerUrl(chainId, status.txHash) : null
  const selectedCore = selectedToken?.core
  const isSelectedCreator = Boolean(
    address && selectedCore?.creator && String(selectedCore.creator).toLowerCase() === String(address).toLowerCase()
  )
  const [creatorFeeBalance, setCreatorFeeBalance] = useState(0n)
  const refetchCreatorFees = useCallback(async () => {
    if (!address || !launchpadAddress) {
      setCreatorFeeBalance(0n)
      return
    }
    const client = getReadClient(dataChainId)
    if (!client) return
    try {
      const value = await client.readContract({
        address: launchpadAddress,
        abi: BASEHUB_B20_CURVE_LAUNCHPAD_ABI,
        functionName: 'fees',
        args: [address],
      })
      setCreatorFeeBalance(value || 0n)
    } catch {
      // Keep the last known value during a temporary RPC failure.
    }
  }, [address, dataChainId, launchpadAddress])

  useEffect(() => {
    refetchCreatorFees()
  }, [refetchCreatorFees])
  const creatorFeeEth = creatorFeeBalance ? Number(formatEther(creatorFeeBalance)) : 0

  const handleClaimCreatorFees = async () => {
    setStatus(null)
    try {
      const result = await claimFees()
      setStatus({ type: 'success', text: 'Creator fees claimed.', txHash: result.txHash })
      await refetchCreatorFees?.()
    } catch (err) {
      setStatus(transactionErrorStatus(err, 'Creator fee claim failed.'))
    }
  }

  return (
    <>
      <Helmet>
        <title>B20 Launchpad - BaseHub</title>
        <meta
          name="description"
          content="Launch B20 tokens on BaseHub with direct or bonding-curve launches."
        />
      </Helmet>
      <style>{responsiveCss}</style>
      <main className="b20-page" style={styles.page}>
        <div style={styles.backRow}>
          <BackButton />
        </div>
        <section className="b20-hero" style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.brandRow}>
              <img src={B20_LOGO_SRC} alt="B20" style={styles.logo} />
              <div>
                <p style={styles.eyebrow}>Base-native token launches</p>
                <h1 className="b20-title" style={styles.title}>B20 Launchpad</h1>
              </div>
            </div>
            <p style={styles.subtitle}>{modeCopy(mode)}</p>
          </div>
          <div className="b20-status-panel" style={styles.statusPanel}>
            <Metric label="Network" value={activeNetworkLabel} tone={isSupported ? 'good' : 'warn'} />
            <Metric label="Asset" value={activation.asset === null ? 'Checking' : activation.asset ? 'Active' : 'Locked'} tone={activation.asset ? 'good' : 'warn'} />
            <Metric label="Stablecoin" value={activation.stablecoin === null ? 'Checking' : activation.stablecoin ? 'Active' : 'Locked'} tone={activation.stablecoin ? 'good' : 'warn'} />
            <Metric label="Reward" value={isTestnet ? 'Testnet' : `${B20_XP_REWARD.toLocaleString()} XP`} tone={isTestnet ? 'warn' : 'good'} />
          </div>
        </section>

        <section className="b20-notice" style={styles.notice}>
          <ShieldCheck size={18} />
          <span>
            {isSupported
              ? isTestnet
                ? 'Base Sepolia test market is available for dry runs before production launches.'
                : 'B20 Launchpad is live on Base mainnet for direct deploys, curve launches, and trading.'
              : 'B20 Launchpad is live on Base mainnet. Switch networks before creating or trading curve tokens.'}
          </span>
          {!isSupported && (
            <button type="button" onClick={switchToBaseNetwork} disabled={isBusy} className="b20-small-button" style={styles.smallButton}>
              Switch to Base
            </button>
          )}
        </section>

        <LaunchpadTrustStrip
          accent="#60a5fa"
          items={[
            { label: 'Verified launch contracts' },
            { label: 'LP burned at graduation' },
            { label: 'Creator fee enabled' },
            { label: 'Base mainnet settlement' },
          ]}
        />

        {status && (
          <section className="b20-feedback" style={{
            ...styles.feedback,
            ...(status.type === 'error' ? styles.feedbackError : status.type === 'pending' ? styles.feedbackPending : styles.feedbackSuccess),
          }}>
            {status.type === 'error' ? <AlertTriangle size={18} /> : status.type === 'pending' ? <Clock size={18} /> : <CheckCircle2 size={18} />}
            <span>{status.text}</span>
            {explorerTx && (
              <a href={explorerTx} target="_blank" rel="noreferrer" className="b20-feedback-link" style={styles.feedbackLink}>
                View tx <ExternalLink size={14} />
              </a>
            )}
          </section>
        )}

        <div style={{ margin: '14px 0 18px' }}>
          <LaunchpadStatStrip
            accent="#3b82f6"
            items={[
              { label: 'Total Tokens', value: platformStats.totalTokens.toLocaleString() },
              { label: 'Graduated', value: platformStats.graduated.toLocaleString(), tone: '#60a5fa' },
              { label: 'Total Volume', value: `${platformStats.totalVolumeETH.toFixed(2)} ETH`, tone: '#60a5fa' },
              { label: 'Trading Fee', value: platformStats.tradingFee, tone: '#60a5fa' },
            ]}
          />
        </div>

        <section style={styles.tabBar}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('tokens')
              setSelectedToken(null)
            }}
            style={{ ...styles.tabButton, ...(activeTab === 'tokens' ? styles.tabButtonActive : {}) }}
          >
            <Flame size={18} /> Tokens
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            style={{ ...styles.tabButton, ...(activeTab === 'create' ? styles.tabButtonActive : {}) }}
          >
            <Plus size={18} /> Create Token
          </button>
        </section>

        {activeTab === 'tokens' && !selectedToken && (
          <TokenBrowser
            tokens={filteredTokens}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            category={category}
            setCategory={setCategory}
            isRefreshing={isRefreshing}
            loadTokens={loadTokens}
            launchpadAddress={launchpadAddress}
            needsBaseSepolia={needsBaseNetworkForCurve}
            onSwitchNetwork={switchToBaseNetwork}
            isBusy={isBusy}
            setActiveTab={setActiveTab}
            networkLabel={activeNetworkLabel}
          />
        )}

        {activeTab === 'create' && (
        <section className="b20-content-grid" style={styles.contentGrid}>
          <div style={styles.primaryPanel}>
            <div style={{ ...styles.modeBar, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setMode('normal')}
                style={{ ...styles.modeButton, ...(mode === 'normal' ? styles.modeButtonActive : {}) }}
              >
                <Rocket size={18} /> Direct Launch
              </button>
              <button
                type="button"
                onClick={() => setMode('curve')}
                style={{ ...styles.modeButton, ...(mode === 'curve' ? styles.modeButtonActive : {}) }}
              >
                <LineChart size={18} /> Curve Launch
              </button>
            </div>
            {mode === 'normal' ? (
              <NormalDeployForm
                form={normalForm}
                setForm={setNormalForm}
                onSubmit={handleNormalSubmit}
                isBusy={isBusy}
                launcherAddress={normalLauncherAddress}
                error={normalError}
              />
            ) : (
              <CurveCreateForm
                form={curveForm}
                setForm={setCurveForm}
                logoPreview={logoPreview}
                isUploadingLogo={isUploadingLogo}
                onLogoUpload={handleLogoUpload}
                onSubmit={handleCurveSubmit}
                isBusy={isBusy}
                isSwitching={isSwitching}
                launchpadAddress={launchpadAddress}
                needsBaseSepolia={needsBaseNetworkForCurve}
                onSwitchNetwork={switchToBaseNetwork}
                error={curveError}
              />
            )}
          </div>

          <aside style={styles.sidePanel}>
            <div style={styles.sideHeader}>
              <div>
                <p style={styles.panelKicker}>Markets</p>
                <h2 style={styles.panelTitle}>Curve launches</h2>
              </div>
              <button type="button" onClick={() => loadTokens({ forceChainRefresh: true })} disabled={isRefreshing} style={styles.iconButton} title="Refresh tokens">
                <RefreshCw size={18} />
              </button>
            </div>

            {!launchpadAddress ? (
              <EmptyState
                icon={<AlertTriangle size={22} />}
                title={needsBaseNetworkForCurve ? 'Switch to Base' : 'Curve contract not configured'}
                text={needsBaseNetworkForCurve ? 'B20 curve markets are deployed on Base mainnet and Base Sepolia testing.' : 'Set the curve launchpad address to list and trade B20 markets.'}
                action={needsBaseNetworkForCurve ? (
                  <button type="button" onClick={switchToBaseNetwork} disabled={isBusy} style={styles.primaryButton}>
                    <Zap size={18} /> Switch network
                  </button>
                ) : null}
              />
            ) : tokens.length === 0 ? (
              <EmptyState icon={<Flame size={22} />} title="No markets yet" text="Curve launches will appear here for buy and sell." />
            ) : (
              <div style={styles.tokenList}>
                {tokens.map((token) => (
                  <button
                    type="button"
                    key={token.address}
                    onClick={() => {
                      setSelectedToken(token)
                      setActiveTab('tokens')
                    }}
                    style={{ ...styles.tokenRow, ...(selectedToken?.address === token.address ? styles.tokenRowActive : {}) }}
                  >
                    <TokenAvatar image={token.image} symbol={token.symbol} />
                    <div style={styles.tokenInfo}>
                      <strong>{token.name}</strong>
                      <span>{token.symbol} · {token.volumeLabel} ETH volume</span>
                    </div>
                    <span style={styles.progressBadge}>{token.progress}%</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </section>
        )}

        {activeTab === 'tokens' && selectedToken && (
          <B20TokenDetail
            tokens={filteredTokens}
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            chainId={dataChainId}
            launchpadAddress={launchpadAddress}
            isBusy={isBusy}
            isCreator={isSelectedCreator}
            creatorFeeEth={creatorFeeEth}
            onTrade={handleTrade}
            onClaimCreatorFees={handleClaimCreatorFees}
            formatTokenAmount={formatTokenAmount}
          />
        )}
      </main>
    </>
  )
}

function B20TokenDetail({
  tokens,
  selectedToken,
  setSelectedToken,
  searchQuery,
  setSearchQuery,
  chainId,
  launchpadAddress,
  isBusy,
  isCreator,
  creatorFeeEth,
  onTrade,
  onClaimCreatorFees,
  formatTokenAmount,
}) {
  return (
    <section style={styles.detailWrap}>
      <div style={styles.detailToolbar}>
        <button type="button" onClick={() => setSelectedToken(null)} style={styles.detailActionButton}>
          Back
        </button>
        <div style={styles.detailSearch}>
          <Search size={15} color="#9ca3af" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search tokens..."
            style={styles.detailSearchInput}
          />
        </div>
      </div>

      <div style={styles.miniTokenScroller}>
        {tokens.map((token) => (
          <MiniB20TokenCard
            key={token.address}
            token={token}
            active={token.address === selectedToken.address}
            onClick={() => setSelectedToken(token)}
          />
        ))}
      </div>

      <section className="b20-market-grid" style={styles.marketGrid}>
        <B20ChartPanel token={selectedToken} chainId={chainId} launchpadAddress={launchpadAddress} />
        <B20TradePanel
          token={selectedToken}
          launchpadAddress={launchpadAddress}
          isBusy={isBusy}
          isCreator={isCreator}
          creatorFeeEth={creatorFeeEth}
          onTrade={onTrade}
          onClaimCreatorFees={onClaimCreatorFees}
          formatTokenAmount={formatTokenAmount}
        />
      </section>
    </section>
  )
}

function MiniB20TokenCard({ token, active, onClick }) {
  const { price: ethPriceUsd } = useEthUsdPrice()
  return (
    <button type="button" onClick={onClick} style={{ ...styles.miniTokenCard, ...(active ? styles.miniTokenCardActive : {}) }}>
      <TokenAvatar image={token.image} symbol={token.symbol} size={30} />
      <div style={styles.miniTokenInfo}>
        <strong>{token.symbol}</strong>
        <span>{formatMarketCap(tokenMarketCapUSD(token, ethPriceUsd))}</span>
      </div>
    </button>
  )
}

function B20ChartPanel({ token, chainId, launchpadAddress }) {
  const { price: ethPriceUsd } = useEthUsdPrice()
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const logClient = useMemo(() => getReadClient(chainId), [chainId])
  const [tradeHistory, setTradeHistory] = useState([])
  const [loadingTrades, setLoadingTrades] = useState(true)
  const marketCapUSD = tokenMarketCapUSD(token, ethPriceUsd)
  const realEth = Number(token?.realEthLabel || 0)
  const txns = tokenTxCount(token)
  const createdAt = token?.createdAtMs || Date.now()
  const activeExplorer = Number(chainId) === NETWORKS.BASE_SEPOLIA.chainId
    ? NETWORKS.BASE_SEPOLIA.blockExplorerUrls[0]
    : NETWORKS.BASE.blockExplorerUrls[0]
  const explorerUrl = token?.address ? `${activeExplorer}/address/${token.address}` : null

  useEffect(() => {
    let cancelled = false
    async function loadTradeHistory() {
      if (!logClient || !launchpadAddress || !token?.address) {
        setTradeHistory([])
        return
      }
      setLoadingTrades(true)
      try {
        const latestBlock = await logClient.getBlockNumber()
        const lookbackTiers = txns > 0 ? [25000n, 100000n, 500000n] : [10000n]
        const chunkSize = 2000n
        const getLogsChunked = async (event, fromBlock) => {
          const logs = []
          for (let start = fromBlock; start <= latestBlock; start += chunkSize + 1n) {
            const end = start + chunkSize > latestBlock ? latestBlock : start + chunkSize
            const chunkLogs = await withRetry(() => logClient.getLogs({
              address: launchpadAddress,
              event,
              args: { t: token.address },
              fromBlock: start,
              toBlock: end,
            }), { attempts: 3, delayMs: 350 }).catch(() => [])
            logs.push(...chunkLogs)
            if (start + chunkSize <= latestBlock) await sleep(80)
          }
          return logs
        }

        let buyLogs = []
        let sellLogs = []
        for (const lookback of lookbackTiers) {
          const fromBlock = latestBlock > lookback ? latestBlock - lookback : 0n
          ;[buyLogs, sellLogs] = await Promise.all([
            getLogsChunked(parseAbiItem('event TB(address indexed t, address indexed b, uint256 e, uint256 o, uint256 f)'), fromBlock),
            getLogsChunked(parseAbiItem('event TS2(address indexed t, address indexed s, uint256 i, uint256 o, uint256 f)'), fromBlock),
          ])
          if (buyLogs.length + sellLogs.length > 0 || lookback === lookbackTiers[lookbackTiers.length - 1]) break
        }

        const logs = [
          ...buyLogs.map((log) => ({
            type: 'buy',
            trader: log.args.b,
            ethAmount: formatEther(log.args.e || 0n),
            tokenAmount: formatUnits(log.args.o || 0n, 18),
            fee: formatEther(log.args.f || 0n),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          })),
          ...sellLogs.map((log) => ({
            type: 'sell',
            trader: log.args.s,
            ethAmount: formatEther(log.args.o || 0n),
            tokenAmount: formatUnits(log.args.i || 0n, 18),
            fee: formatEther(log.args.f || 0n),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          })),
        ].sort((a, b) => Number(a.blockNumber - b.blockNumber))

        const recentBlocks = Array.from(new Set(logs.slice(-40).map((log) => log.blockNumber.toString())))
        const blockTimes = new Map()
        await Promise.all(recentBlocks.map(async (blockNumber) => {
          try {
            const block = await logClient.getBlock({ blockNumber: BigInt(blockNumber) })
            blockTimes.set(blockNumber, Number(block.timestamp) * 1000)
          } catch {
            blockTimes.set(blockNumber, Date.now())
          }
        }))

        const withTimes = logs.map((log) => ({
          ...log,
          timestamp: blockTimes.get(log.blockNumber.toString()) || createdAt,
        }))
        if (!cancelled) {
          setTradeHistory((previous) => {
            if (withTimes.length > 0) return withTimes
            return previous.length > 0 ? previous : []
          })
        }
      } catch {
        if (!cancelled) setTradeHistory((previous) => previous)
      } finally {
        if (!cancelled) setLoadingTrades(false)
      }
    }
    loadTradeHistory()
    return () => {
      cancelled = true
    }
  }, [createdAt, launchpadAddress, logClient, token?.address, txns])

  const chartData = useMemo(() => {
    const now = Date.now()
    const firstTradeAt = tradeHistory[0]?.timestamp || createdAt || now
    const ageMs = Math.max(now - firstTradeAt, 0)
    const bucketMs = ageMs <= 48 * 60 * 60 * 1000 ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000
    const maxBuckets = ageMs <= 48 * 60 * 60 * 1000 ? 96 : 30
    const startMs = Math.floor(firstTradeAt / bucketMs) * bucketMs
    const base = ethPriceUsd
    const data = []
    let open = base
    let bucketStart = startMs

    for (let index = 0; index < maxBuckets && bucketStart <= now; index++) {
      const bucketEnd = Math.min(bucketStart + bucketMs, now + 1)
      const bucketTrades = tradeHistory.filter((trade) => trade.timestamp >= bucketStart && trade.timestamp < bucketEnd)
      let high = open
      let low = open
      let close = open

      bucketTrades.forEach((trade) => {
        const eth = Number(trade.ethAmount || 0)
        const change = eth * ethPriceUsd * 2
        close = trade.type === 'buy' ? close + change : close - change
        close = Math.max(base * 0.3, close)
        high = Math.max(high, close)
        low = Math.min(low, close)
      })

      data.push({
        time: Math.floor(bucketStart / 1000),
        open,
        high,
        low,
        close,
      })
      open = close
      bucketStart += bucketMs
    }

    if (data.length === 0) {
      data.push({
        time: Math.floor(now / 1000),
        open: base,
        high: base,
        low: base,
        close: base,
      })
    }
    return data
  }, [createdAt, ethPriceUsd, tradeHistory])

  useEffect(() => {
    const container = chartContainerRef.current
    if (!container) return undefined

    if (!chartRef.current) {
      const chart = createChart(container, {
        autoSize: true,
        height: 350,
        layout: { background: { color: 'transparent' }, textColor: '#9ca3af' },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.06)' },
          horzLines: { color: 'rgba(255,255,255,0.06)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          timeVisible: false,
          secondsVisible: false,
          rightOffset: 1,
          barSpacing: 18,
          minBarSpacing: 8,
        },
      })
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      })
      chartRef.current = chart
      seriesRef.current = series
    }

    seriesRef.current?.setData(chartData)
    const timeScale = chartRef.current?.timeScale()
    timeScale?.fitContent()
    if (chartData.length < 14) {
      timeScale?.setVisibleLogicalRange({ from: 0, to: 14 })
    }

    return undefined
  }, [chartData])

  useEffect(() => () => {
    chartRef.current?.remove()
    chartRef.current = null
    seriesRef.current = null
  }, [])

  return (
    <div style={styles.marketChartPanel}>
      <div style={styles.marketChartHeader}>
        <div>
          <div style={styles.marketCapValue}>{formatMarketCap(marketCapUSD)}</div>
          <div style={styles.marketMuted}>Market Cap</div>
        </div>
        <div style={styles.marketChartMeta}>
          <span>1D chart</span>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noreferrer" style={styles.addressPill}>
              {shortAddress(token.address)}
            </a>
          )}
        </div>
      </div>

      <div style={styles.lpProgressWrap}>
        <div style={styles.lpProgressTop}>
          <span>Progress to LP Lock</span>
          <strong>{token.progress >= 100 ? 'Graduated' : `${token.progress.toFixed(1)}% (${realEth.toFixed(4)}/5 ETH)`}</strong>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${Math.min(token.progress, 100)}%` }} />
        </div>
      </div>

      <div style={styles.chartCanvasWrap}>
        <div ref={chartContainerRef} style={styles.chartCanvas} />
        {loadingTrades && tradeHistory.length === 0 && (
          <div style={styles.chartLoading}>
            <RefreshCw size={22} /> Loading chart data...
          </div>
        )}
      </div>

      <div className="b20-market-stats" style={styles.marketStats}>
        <Metric label="24h High" value={formatMarketCap(Math.max(...chartData.map((item) => item.high)))} tone="good" />
        <Metric label="24h Low" value={formatMarketCap(Math.min(...chartData.map((item) => item.low)))} tone="warn" />
        <Metric label="Volume" value={`${token.volumeLabel} ETH`} />
        <Metric label="Txns" value={txns} />
      </div>

      <div style={styles.transactionsPanel}>
        <div style={styles.transactionsHeader}>
          <BarChart3 size={16} /> Recent transactions
        </div>
        <div style={styles.transactionsTable}>
          <div style={styles.transactionHead}>
            <span>Account</span>
            <span>Type</span>
            <span>Amount</span>
            <span><Clock size={12} /> Time</span>
            <span>Txn</span>
          </div>
          {loadingTrades && tradeHistory.length === 0 ? (
            <div style={styles.emptyTransactions}>Loading...</div>
          ) : tradeHistory.length === 0 ? (
            <div style={styles.emptyTransactions}>No transactions yet</div>
          ) : (
            tradeHistory.slice(-15).reverse().map((trade) => (
              <div key={`${trade.txHash}-${trade.type}-${trade.blockNumber}`} style={styles.transactionRow}>
                <span title={trade.trader}>{shortAddress(trade.trader)}</span>
                <span style={trade.type === 'buy' ? styles.buyText : styles.sellText}>{trade.type === 'buy' ? 'Buy' : 'Sell'}</span>
                <span>{Number(trade.ethAmount || 0).toFixed(4)} ETH</span>
                <span>{timeAgo(trade.timestamp)}</span>
                <a
                  href={`${activeExplorer}/tx/${trade.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.txLink}
                >
                  {shortAddress(trade.txHash)}
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {token.description && <p style={styles.mutedText}>{token.description}</p>}
    </div>
  )
}

function B20TradePanel({
  token,
  launchpadAddress,
  isBusy,
  isCreator,
  creatorFeeEth,
  onTrade,
  onClaimCreatorFees,
  formatTokenAmount,
}) {
  const { address, isConnected } = useAccount()
  const [tradeMode, setTradeMode] = useState('buy')
  const [amount, setAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const { data: ethBalance } = useBalance({ address })
  const { data: tokenBalance } = useReadContract({
    address: token?.address,
    abi: B20_CURVE_ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && token?.address) },
  })

  const userEthBalance = ethBalance ? formatEther(ethBalance.value) : '0'
  const userTokenBalanceRaw = tokenBalance || 0n
  const userTokenBalance = formatUnits(userTokenBalanceRaw, 18)
  const maxSellableRaw = useMemo(
    () => getCurveSellableAmount(token, userTokenBalanceRaw),
    [token, userTokenBalanceRaw]
  )
  const maxSellableAmount = formatUnits(maxSellableRaw, 18)
  const quickAmounts = tradeMode === 'buy' ? ['0.001', '0.01', '0.05', '0.1'] : ['25%', '50%', '75%', '100%']
  const tokenSymbol = token?.symbol || 'B20'
  const normalizedAmount = normalizeDecimalInput(amount, 18)
  const amountRaw = tradeMode === 'sell' ? parseTokenAmountSafe(amount) : 0n
  const amountNumber = Number(normalizedAmount || 0)
  const reserveEth = Number(formatEther(token?.core?.virtualETH || 0n))
  const reserveTokens = Number(formatUnits(token?.core?.virtualTokens || 0n, 18))
  const feeMultiplier = 1 - (B20_CURVE_TRADING_FEE_BPS / 10000)
  const estimatedReceive = useMemo(() => {
    if (!Number.isFinite(amountNumber) || amountNumber <= 0 || reserveEth <= 0 || reserveTokens <= 0) return 0
    if (tradeMode === 'buy') {
      const netEth = amountNumber * feeMultiplier
      return (reserveTokens * netEth) / (reserveEth + netEth)
    }
    const grossEth = (reserveEth * amountNumber) / (reserveTokens + amountNumber)
    return grossEth * feeMultiplier
  }, [amountNumber, feeMultiplier, reserveEth, reserveTokens, tradeMode])
  const priceImpact = useMemo(() => {
    if (estimatedReceive <= 0 || amountNumber <= 0 || reserveEth <= 0 || reserveTokens <= 0) return 0
    const spotPrice = reserveEth / reserveTokens
    const averagePrice = tradeMode === 'buy'
      ? (amountNumber * feeMultiplier) / estimatedReceive
      : (estimatedReceive / feeMultiplier) / amountNumber
    return Math.max(0, tradeMode === 'buy' ? ((averagePrice / spotPrice) - 1) * 100 : (1 - (averagePrice / spotPrice)) * 100)
  }, [amountNumber, estimatedReceive, feeMultiplier, reserveEth, reserveTokens, tradeMode])
  const sellAmountTooHigh = tradeMode === 'sell' && amountRaw > maxSellableRaw
  const disabled =
    !isConnected ||
    !normalizedAmount ||
    Number(normalizedAmount) <= 0 ||
    sellAmountTooHigh ||
    isBusy ||
    isProcessing ||
    token?.core?.graduated

  const handleQuickAmount = (value) => {
    if (tradeMode === 'buy') {
      setAmount(value)
      return
    }
    const percent = Number.parseInt(value, 10) / 100
    const nextAmount = (maxSellableRaw * BigInt(Math.round(percent * 10000))) / 10000n
    setAmount(nextAmount > 0n ? formatTokenInput(nextAmount, 6) : '')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (disabled) return
    setIsProcessing(true)
    try {
      await onTrade(tradeMode, amount)
      setAmount('')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.proTradePanel}>
      <div className="b20-segmented" style={styles.tradeTabs}>
        <button
          type="button"
          onClick={() => {
            setTradeMode('buy')
            setAmount('')
          }}
          style={{ ...styles.tradeTab, ...(tradeMode === 'buy' ? styles.tradeTabBuyActive : {}) }}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => {
            setTradeMode('sell')
            setAmount('')
          }}
          style={{ ...styles.tradeTab, ...(tradeMode === 'sell' ? styles.tradeTabSellActive : {}) }}
        >
          Sell
        </button>
      </div>

      <div style={styles.balanceBox}>
        <div style={styles.balanceCopy}>
          <span>{tradeMode === 'buy' ? 'ETH Balance' : 'Token Balance'}</span>
          {tradeMode === 'sell' && <small style={styles.balanceHint}>Sellable now {formatNumber(maxSellableAmount, 2)} {tokenSymbol}</small>}
        </div>
        <strong>{tradeMode === 'buy' ? `${Number(userEthBalance || 0).toFixed(4)} ETH` : `${formatNumber(userTokenBalance, 2)} ${tokenSymbol}`}</strong>
      </div>

      <label style={styles.proAmountLabel}>
        <span>{tradeMode === 'buy' ? 'ETH amount' : `${tokenSymbol} amount`}</span>
        <div style={styles.proAmountBox}>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(normalizeDecimalInput(event.target.value, 18))}
            placeholder={tradeMode === 'buy' ? '0.001' : '1000'}
            style={styles.proAmountInput}
          />
          <strong>{tradeMode === 'buy' ? 'ETH' : tokenSymbol}</strong>
        </div>
      </label>

      <div style={styles.quickAmountGrid}>
        {quickAmounts.map((value) => (
          <button key={value} type="button" onClick={() => handleQuickAmount(value)} style={styles.quickAmountButton}>
            {value}
          </button>
        ))}
      </div>

      <div style={styles.tradePreview}>
        <div style={{ padding: '10px 4px', display: 'grid', gap: 3 }}>
          <span>Estimated received</span>
          <strong style={{ color: '#f8fafc', fontSize: 13 }}>{estimatedReceive > 0 ? `${formatNumber(estimatedReceive, 4)} ${tradeMode === 'buy' ? tokenSymbol : 'ETH'}` : '-'}</strong>
        </div>
        <div style={{ padding: '10px 4px 10px 12px', borderLeft: '1px solid rgba(148, 163, 184, 0.12)', display: 'grid', gap: 3 }}>
          <span>Price impact</span>
          <strong style={{ color: priceImpact > 5 ? '#fbbf24' : '#86efac', fontSize: 13 }}>{estimatedReceive > 0 ? `${priceImpact.toFixed(2)}%` : '-'}</strong>
        </div>
      </div>

      <button type="submit" disabled={disabled} style={{ ...styles.proTradeButton, ...(tradeMode === 'sell' ? styles.proSellButton : {}) }}>
        <ArrowRightLeft size={18} />
        {!isConnected
          ? 'Connect Wallet'
          : isBusy || isProcessing
            ? 'Processing...'
            : token?.core?.graduated
              ? 'Graduated'
              : tradeMode === 'buy'
                ? `Buy ${tokenSymbol}`
                : `Sell ${tokenSymbol}`}
      </button>

      {sellAmountTooHigh && (
        <div style={styles.tradeWarning}>
          Current curve liquidity supports up to {formatNumber(maxSellableAmount, 4)} {tokenSymbol} for this sell.
        </div>
      )}

      <div style={styles.tradeFacts}>
        <div style={styles.tradeFactsRow}>
          <span>Trading fee</span>
          <strong style={styles.tradeFactsValue}>{B20_CURVE_TRADING_FEE_BPS / 100}%</strong>
        </div>
        <div style={styles.tradeFactsRow}>
          <span>Buys / sells</span>
          <strong style={styles.tradeFactsValue}>{Number(token?.stats?.buys || 0n)} / {Number(token?.stats?.sells || 0n)}</strong>
        </div>
        <div style={styles.tradeFactsRow}>
          <span>Virtual tokens</span>
          <strong style={styles.tradeFactsValue}>{formatNumber(formatUnits(token?.core?.virtualTokens || 0n, 18), 2)}</strong>
        </div>
      </div>

      {isCreator && (
        <div style={styles.creatorFeePanel}>
          <div>
            <span>Creator fees</span>
            <strong>{creatorFeeEth.toFixed(6)} ETH</strong>
          </div>
          <button
            type="button"
            onClick={onClaimCreatorFees}
            disabled={isBusy || isProcessing || creatorFeeEth <= 0}
            style={styles.secondaryButton}
          >
            <Wallet size={16} /> Claim
          </button>
        </div>
      )}

      {launchpadAddress && (
        <div style={styles.launchpadNote}>
          Launchpad {shortAddress(launchpadAddress)}
        </div>
      )}
    </form>
  )
}

function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <div style={styles.statCard}>
      <span>{label}</span>
      <strong style={tone === 'blue' ? styles.statCardBlue : undefined}>{value}</strong>
    </div>
  )
}

function TokenBrowser({
  tokens,
  setSelectedToken,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  category,
  setCategory,
  isRefreshing,
  loadTokens,
  launchpadAddress,
  needsBaseSepolia,
  onSwitchNetwork,
  isBusy,
  setActiveTab,
  networkLabel,
}) {
  const graduatedCount = tokens.filter((token) => token.core?.graduated).length
  const trendingTokens = useMemo(() => (
    tokens
      .filter(isTrendingB20Token)
      .sort((a, b) => b20TrendScore(b) - b20TrendScore(a))
      .slice(0, 4)
  ), [tokens])
  return (
    <section style={styles.browserPanel}>
      <div className="b20-browser-heading" style={styles.browserHeading}>
        <div>
          <p style={styles.panelKicker}>Markets</p>
          <h2 style={styles.browserTitle}>Launched B20 Tokens</h2>
          <span style={styles.browserSubtitle}>Browse live curve launches, open charts, and trade from one market view.</span>
        </div>
        <div style={styles.browserMeta}>
          <span style={styles.browserMetaPill}>{tokens.length} listed</span>
          <span style={styles.browserMetaPill}>{graduatedCount} graduated</span>
        </div>
      </div>

      <div className="b20-browser-controls" style={styles.browserControls}>
        <div style={styles.searchBar}>
          <Search size={19} color="#8da0bb" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, symbol, or address..."
            style={styles.searchInput}
          />
        </div>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.sortSelect}>
          <option value="newest">Newest</option>
          <option value="volume">Volume</option>
          <option value="marketcap">Market Cap</option>
          <option value="progress">Progress</option>
        </select>
        <button type="button" onClick={() => loadTokens({ forceChainRefresh: true })} disabled={isRefreshing} style={styles.refreshButton}>
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div style={styles.categoryBar}>
        {[
          { id: 'all', label: 'All', icon: Globe },
          { id: 'trending', label: 'Trending', icon: Flame },
          { id: 'new', label: 'New', icon: Zap },
          { id: 'graduated', label: 'Graduated', icon: Star },
        ].map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setCategory(item.id)}
            style={{ ...styles.categoryButton, ...(category === item.id ? styles.categoryButtonActive : {}) }}
          >
            <item.icon size={16} /> {item.label}
          </button>
        ))}
      </div>

      {trendingTokens.length > 0 && category !== 'trending' && (
        <section style={styles.trendingPanel}>
          <div style={styles.trendingHeader}>
            <div>
              <p style={styles.panelKicker}>Trending</p>
              <h3 style={styles.trendingTitle}>High activity B20 launches</h3>
            </div>
            <span style={styles.trendingHint}>Ranked by volume, txns, and curve progress</span>
          </div>
          <div className="b20-token-grid" style={styles.trendingGrid}>
            {trendingTokens.map((token) => (
              <B20TokenCard
                key={`trending-${token.address}`}
                token={token}
                onClick={() => setSelectedToken(token)}
                featured
              />
            ))}
          </div>
        </section>
      )}

      {!launchpadAddress ? (
        <EmptyState
          icon={<AlertTriangle size={28} />}
          title={needsBaseSepolia ? 'Switch to Base' : 'Curve contract not configured'}
          text={needsBaseSepolia ? 'B20 curve launches are deployed on Base mainnet. Base Sepolia remains available for testing.' : 'Curve markets are unavailable on the current network.'}
          action={needsBaseSepolia ? (
            <button type="button" onClick={onSwitchNetwork} disabled={isBusy} style={styles.primaryButton}>
              <Zap size={18} /> Switch network
            </button>
          ) : null}
        />
      ) : isRefreshing && tokens.length === 0 ? (
        <TokenGridSkeleton count={6} accent="#3b82f6" />
      ) : tokens.length === 0 ? (
        <div style={styles.emptyMarket}>
          <Rocket size={42} />
          <strong>No B20 markets found</strong>
          <span>Create the first curve launch and it will appear here.</span>
          <button type="button" onClick={() => setActiveTab('create')} style={styles.primaryButton}>
            <Plus size={18} /> Create Token
          </button>
        </div>
      ) : (
        <div className="b20-token-grid" style={styles.tokenGrid}>
          {tokens.map((token) => (
            <B20TokenCard
              key={token.address}
              token={token}
              onClick={() => setSelectedToken(token)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function B20TokenCard({ token, active, onClick, featured = false }) {
  const { price: ethPriceUsd } = useEthUsdPrice()
  const txns = tokenTxCount(token)
  const volume = Number(token.volumeLabel || 0)
  const volumeLabel = volume > 0 && volume < 0.0001 ? '<0.0001' : volume.toFixed(4)
  return (
    <button type="button" onClick={onClick} className={`launchpad-token-card${featured ? ' launchpad-featured-card' : ''}`} style={{ ...styles.marketCard, ...(featured ? styles.marketCardFeatured : {}), ...(active ? styles.marketCardActive : {}) }}>
      <div style={styles.marketCardTop}>
        <TokenAvatar image={token.image} symbol={token.symbol} size={72} />
        <div style={styles.marketCardName}>
          <strong>{token.name}</strong>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <img src="/base-logo.jpg" alt="" aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
            ${token.symbol}
          </span>
          {featured && <em style={styles.trendingBadge}>Trending</em>}
        </div>
        <div style={styles.marketCap}>
          <strong>{formatMarketCap(tokenMarketCapUSD(token, ethPriceUsd))}</strong>
          <span>{token.progress > 0 ? `+${token.progress.toFixed(2)}%` : 'NEW'}</span>
        </div>
      </div>
      <div style={styles.marketCardStats}>
        <div style={styles.marketCardStat}>
          <span style={styles.marketCardStatLabel}>Volume</span>
          <strong style={styles.marketCardStatValue}>{volumeLabel}</strong>
          <em style={styles.marketCardStatUnit}>ETH</em>
        </div>
        <div style={styles.marketCardStat}>
          <span style={styles.marketCardStatLabel}>Txns</span>
          <strong style={styles.marketCardStatValue}>{txns}</strong>
        </div>
        <div style={styles.marketCardStat}>
          <span style={styles.marketCardStatLabel}>Progress</span>
          <strong style={styles.marketCardStatValue}>{token.progress.toFixed(1)}%</strong>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <LaunchpadProgress value={token.progress} graduated={token.core?.graduated} accent="#3b82f6" />
      </div>
    </button>
  )
}

function Metric({ label, value, tone = 'neutral' }) {
  const toneStyle = tone === 'good' ? styles.metricGood : tone === 'warn' ? styles.metricWarn : {}
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={toneStyle}>{value}</strong>
    </div>
  )
}

function NormalDeployForm({ form, setForm, onSubmit, isBusy, launcherAddress, error }) {
  const isStablecoin = form.variant === 'stablecoin'
  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.panelHeader}>
        <div>
          <p style={styles.panelKicker}>Direct</p>
          <h2 style={styles.panelTitle}>Direct B20 Launch</h2>
        </div>
        <span style={styles.feePill}>{B20_DEPLOY_FEE_ETH} ETH fee</span>
      </div>
      <div className="b20-segmented" style={styles.segmented}>
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, variant: 'asset' }))}
          style={{ ...styles.segment, ...(!isStablecoin ? styles.segmentActive : {}) }}
        >
          Asset
        </button>
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, variant: 'stablecoin' }))}
          style={{ ...styles.segment, ...(isStablecoin ? styles.segmentActive : {}) }}
        >
          Stablecoin
        </button>
      </div>
      <Field label="Token name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="BaseHub Asset" />
      <Field label="Symbol" value={form.symbol} onChange={(value) => setForm((prev) => ({ ...prev, symbol: value }))} placeholder="BHUB" />
      {isStablecoin ? (
        <Field label="Currency code" value={form.currency} onChange={(value) => setForm((prev) => ({ ...prev, currency: value }))} placeholder="USD" />
      ) : (
        <div className="b20-two-col" style={styles.twoCol}>
          <Field label="Decimals" value={form.decimals} onChange={(value) => setForm((prev) => ({ ...prev, decimals: value }))} placeholder="18" />
          <Field label="Initial mint" value={form.initialMint} onChange={(value) => setForm((prev) => ({ ...prev, initialMint: value }))} placeholder="Optional" />
          <Field label="Supply cap" value={form.supplyCap} onChange={(value) => setForm((prev) => ({ ...prev, supplyCap: value }))} placeholder="1000000000" />
        </div>
      )}
      <ConfigLine icon={<Wallet size={16} />} label="Launcher" value={launcherAddress ? shortAddress(launcherAddress) : 'Not configured'} />
      {error && <p style={styles.errorLine}>{error}</p>}
      <button type="submit" disabled={isBusy || !launcherAddress} style={styles.primaryButton}>
        <Rocket size={18} /> Deploy B20
      </button>
    </form>
  )
}

function CurveCreateForm({
  form,
  setForm,
  logoPreview,
  isUploadingLogo,
  onLogoUpload,
  onSubmit,
  isBusy,
  isSwitching,
  launchpadAddress,
  needsBaseSepolia,
  onSwitchNetwork,
  error,
}) {
  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <div style={styles.panelHeader}>
        <div>
          <p style={styles.panelKicker}>Bonding curve</p>
          <h2 style={styles.panelTitle}>Curve Launch</h2>
        </div>
        <span style={styles.feePill}>{B20_CURVE_CREATE_FEE_ETH} ETH create</span>
      </div>
      <div className="b20-logo-uploader" style={styles.logoUploader}>
        <div style={styles.logoPreview}>
          {logoPreview || form.image ? (
            <img src={logoPreview || form.image} alt="Token logo" style={styles.logoPreviewImage} />
          ) : (
            <Image size={24} />
          )}
        </div>
        <div style={styles.logoUploadBody}>
          <strong>Token logo</strong>
          <span>{form.image ? 'Uploaded to IPFS' : 'PNG, JPG or GIF'}</span>
        </div>
        <label style={styles.uploadButton}>
          <Upload size={16} />
          {isUploadingLogo ? 'Uploading' : 'Upload'}
          <input type="file" accept="image/*" onChange={onLogoUpload} disabled={isBusy || isUploadingLogo} style={styles.hiddenInput} />
        </label>
      </div>
      {form.image && (
        <input
          value={form.image}
          onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))}
          placeholder="https://..."
          style={styles.compactInput}
        />
      )}
      <div className="b20-two-col" style={{ ...styles.twoCol, gridTemplateColumns: 'minmax(0, 1.3fr) minmax(120px, 0.7fr)' }}>
        <Field label="Token name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="BaseHub Curve" />
        <Field label="Symbol" value={form.symbol} onChange={(value) => setForm((prev) => ({ ...prev, symbol: value.toUpperCase() }))} placeholder="CURVE" />
      </div>
      <label style={styles.label}>
        <span>Description</span>
        <textarea
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Short launch description"
          style={{ ...styles.input, minHeight: 76, resize: 'vertical' }}
        />
      </label>
      <label style={styles.label}>
        <span>Creator allocation: {(Number(form.creatorAllocationBps) / 100).toFixed(2)}%</span>
        <input
          type="range"
          min="0"
          max="1000"
          step="25"
          value={form.creatorAllocationBps}
          onChange={(event) => setForm((prev) => ({ ...prev, creatorAllocationBps: event.target.value }))}
          style={styles.range}
        />
      </label>
      <div className="b20-launch-facts" style={styles.launchFacts}>
        <ConfigLine icon={<Flame size={16} />} label="Supply" value={B20_CURVE_TOTAL_SUPPLY} />
        <ConfigLine icon={<LineChart size={16} />} label="Graduation" value={`${B20_CURVE_GRADUATION_ETH} ETH`} />
        <ConfigLine icon={<Activity size={16} />} label="Trading fee" value={`${B20_CURVE_TRADING_FEE_BPS / 100}%`} />
        <ConfigLine icon={<Wallet size={16} />} label="Launchpad" value={launchpadAddress ? shortAddress(launchpadAddress) : needsBaseSepolia ? 'Base' : 'Not configured'} />
      </div>
      {error && <p style={styles.errorLine}>{error}</p>}
      {needsBaseSepolia ? (
        <button type="button" onClick={onSwitchNetwork} disabled={isBusy || isSwitching} style={styles.primaryButton}>
          <Zap size={18} /> {isSwitching ? 'Switching network' : 'Switch to Base'}
        </button>
      ) : (
        <button type="submit" disabled={isBusy || isUploadingLogo || !form.image || !launchpadAddress} style={styles.primaryButton}>
          <Rocket size={18} /> Launch curve
        </button>
      )}
    </form>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={styles.label}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={styles.input} />
    </label>
  )
}

function ConfigLine({ icon, label, value }) {
  return (
    <div style={styles.configLine}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TokenAvatar({ image, symbol, size = 42 }) {
  const dynamicStyle = { width: size, height: size }
  if (image) return <img src={image} alt={symbol} style={{ ...styles.tokenAvatar, ...dynamicStyle }} />
  return <div style={{ ...styles.tokenAvatarFallback, ...dynamicStyle }}>{String(symbol || 'B').slice(0, 2)}</div>
}

function EmptyState({ icon, title, text, action = null }) {
  return (
    <div style={styles.emptyState}>
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '32px clamp(16px, 3vw, 48px) 64px',
    background: '#08111f',
    color: '#e5e7eb',
  },
  soonHero: {
    maxWidth: 960,
    margin: '48px auto 0',
    border: '1px solid rgba(59, 130, 246, 0.22)',
    borderRadius: 18,
    background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(8, 18, 36, 0.98))',
    padding: 34,
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.28)',
  },
  soonBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    marginBottom: 22,
  },
  soonLogo: {
    width: 76,
    height: 76,
    objectFit: 'contain',
    borderRadius: 16,
    border: '1px solid rgba(59, 130, 246, 0.34)',
    background: 'rgba(59, 130, 246, 0.12)',
    padding: 10,
  },
  soonTitle: {
    margin: 0,
    fontSize: 48,
    lineHeight: 1.05,
    color: '#f8fafc',
  },
  soonCopy: {
    maxWidth: 760,
    margin: '0 0 24px',
    color: '#a8b3c7',
    fontSize: 18,
    lineHeight: 1.65,
  },
  soonGrid: {
    maxWidth: 'none',
    margin: 0,
  },
  backRow: {
    maxWidth: 1280,
    margin: '0 auto 22px',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(420px, 0.85fr)',
    gap: 20,
    alignItems: 'center',
    maxWidth: 1280,
    margin: '0 auto 18px',
    border: '1px solid rgba(96, 165, 250, 0.18)',
    background: 'linear-gradient(180deg, #0f1c31 0%, #0b1425 100%)',
    borderRadius: 8,
    padding: 18,
  },
  heroLeft: {
    minWidth: 0,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    minWidth: 0,
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: 'contain',
    borderRadius: 8,
    background: '#08111f',
    border: '1px solid rgba(96, 165, 250, 0.22)',
  },
  eyebrow: {
    margin: 0,
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  title: {
    margin: '2px 0 0',
    fontSize: 34,
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#a8b3c7',
    fontSize: 15,
    lineHeight: 1.5,
    maxWidth: 760,
  },
  modeBar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  modeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: '#0b1324',
    color: '#a8b3c7',
    borderRadius: 8,
    padding: '11px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  modeButtonActive: {
    color: '#fff',
    borderColor: '#60a5fa',
    background: '#1e3a6b',
  },
  statusPanel: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 0,
    borderLeft: '1px solid rgba(148, 163, 184, 0.14)',
  },
  metric: {
    display: 'grid',
    gap: 5,
    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
    padding: '10px 14px',
    minWidth: 0,
  },
  metricLabel: {
    color: '#8fa0bb',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  metricGood: { color: '#86efac' },
  metricWarn: { color: '#fbbf24' },
  notice: {
    maxWidth: 1280,
    margin: '0 auto 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid rgba(96, 165, 250, 0.28)',
    background: '#10223d',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#bfdbfe',
    lineHeight: 1.45,
  },
  smallButton: {
    marginLeft: 'auto',
    border: 0,
    borderRadius: 8,
    background: '#2563eb',
    color: '#fff',
    padding: '9px 12px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  feedback: {
    maxWidth: 1280,
    margin: '0 auto 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    padding: '12px 14px',
    fontWeight: 700,
  },
  feedbackSuccess: { background: 'rgba(22, 163, 74, 0.14)', color: '#bbf7d0', border: '1px solid rgba(34, 197, 94, 0.3)' },
  feedbackPending: { background: 'rgba(217, 119, 6, 0.14)', color: '#fde68a', border: '1px solid rgba(245, 158, 11, 0.32)' },
  feedbackError: { background: 'rgba(220, 38, 38, 0.14)', color: '#fecaca', border: '1px solid rgba(248, 113, 113, 0.32)' },
  feedbackLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    color: 'inherit',
    textDecoration: 'none',
  },
  platformStats: {
    maxWidth: 1280,
    margin: '0 auto 18px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
  },
  statCard: {
    border: '1px solid rgba(59, 130, 246, 0.24)',
    borderRadius: 12,
    background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.08))',
    padding: '18px 20px',
    display: 'grid',
    gap: 12,
    minHeight: 94,
  },
  statCardBlue: {
    color: '#3b82f6',
  },
  tabBar: {
    maxWidth: 1280,
    margin: '0 auto 18px',
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  tabButton: {
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    border: 0,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '12px 24px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  tabButtonActive: {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  },
  browserPanel: {
    maxWidth: 1280,
    margin: '0 auto 20px',
  },
  browserHeading: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  browserTitle: {
    margin: '2px 0 4px',
    fontSize: 28,
    lineHeight: 1.1,
    color: '#f8fafc',
  },
  browserSubtitle: {
    display: 'block',
    color: '#9ca3af',
    fontSize: 14,
  },
  browserMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  browserMetaPill: {
    border: '1px solid rgba(59, 130, 246, 0.22)',
    borderRadius: 999,
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#bfdbfe',
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 900,
  },
  browserControls: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 180px auto',
    gap: 12,
    marginBottom: 14,
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: 10,
    background: 'rgba(0, 0, 0, 0.28)',
    padding: '0 14px',
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 0,
    outline: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 15,
  },
  sortSelect: {
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: 10,
    background: 'rgba(0, 0, 0, 0.28)',
    color: '#fff',
    padding: '0 14px',
    minHeight: 52,
    outline: 'none',
  },
  refreshButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: '1px solid rgba(59, 130, 246, 0.24)',
    borderRadius: 10,
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#bfdbfe',
    padding: '0 16px',
    minHeight: 52,
    fontWeight: 900,
    cursor: 'pointer',
  },
  categoryBar: {
    display: 'flex',
    gap: 8,
    marginBottom: 18,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  categoryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: 10,
    background: 'rgba(0, 0, 0, 0.22)',
    color: '#9ca3af',
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  categoryButtonActive: {
    borderColor: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.18)',
    color: '#60a5fa',
  },
  trendingPanel: {
    border: '1px solid rgba(34, 197, 94, 0.2)',
    borderRadius: 14,
    background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.11), rgba(37, 99, 235, 0.08))',
    padding: 16,
    marginBottom: 18,
  },
  trendingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 14,
    marginBottom: 14,
  },
  trendingTitle: {
    margin: '2px 0 0',
    color: '#f8fafc',
    fontSize: 20,
    lineHeight: 1.15,
  },
  trendingHint: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: 800,
    textAlign: 'right',
  },
  trendingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  tokenGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  marketCard: {
    width: '100%',
    display: 'grid',
    gap: 16,
    border: '1px solid rgba(59, 130, 246, 0.22)',
    borderTop: '3px solid rgba(59, 130, 246, 0.38)',
    borderRadius: 8,
    background: 'linear-gradient(145deg, rgba(18, 18, 28, 0.98), rgba(13, 17, 31, 0.98))',
    color: '#fff',
    padding: 18,
    cursor: 'pointer',
    textAlign: 'left',
  },
  marketCardActive: {
    borderColor: '#60a5fa',
    boxShadow: '0 0 0 1px rgba(96, 165, 250, 0.25)',
  },
  marketCardFeatured: {
    borderColor: 'rgba(34, 197, 94, 0.42)',
    borderTopColor: '#22c55e',
    boxShadow: '0 16px 38px rgba(22, 163, 74, 0.08)',
  },
  marketCardTop: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 14,
  },
  marketCardName: {
    display: 'grid',
    gap: 6,
    minWidth: 0,
  },
  trendingBadge: {
    justifySelf: 'start',
    border: '1px solid rgba(34, 197, 94, 0.32)',
    borderRadius: 999,
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#86efac',
    padding: '3px 7px',
    fontSize: 10,
    fontStyle: 'normal',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  marketCap: {
    display: 'grid',
    gap: 6,
    textAlign: 'right',
    color: '#3b82f6',
  },
  marketCardStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
    padding: '10px 0',
  },
  marketCardStat: {
    minWidth: 0,
    display: 'grid',
    gap: 3,
    alignContent: 'center',
    padding: '5px 8px',
    textAlign: 'center',
  },
  marketCardStatLabel: {
    color: '#8fa0bb',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  marketCardStatValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.05,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  marketCardStatUnit: {
    color: '#8fa0bb',
    fontSize: 10,
    fontStyle: 'normal',
    fontWeight: 800,
  },
  emptyMarket: {
    minHeight: 320,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 12,
    color: '#9ca3af',
    textAlign: 'center',
    border: '1px dashed rgba(59, 130, 246, 0.22)',
    borderRadius: 12,
    background: 'rgba(0, 0, 0, 0.16)',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 400px)',
    gap: 14,
    maxWidth: 1280,
    margin: '0 auto 20px',
  },
  primaryPanel: {
    border: '1px solid rgba(96, 165, 250, 0.18)',
    background: 'linear-gradient(180deg, #0d1728 0%, #091323 100%)',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 18px 48px rgba(2, 6, 23, 0.26)',
  },
  sidePanel: {
    border: '1px solid rgba(96, 165, 250, 0.18)',
    background: '#0d1728',
    borderRadius: 12,
    padding: 18,
    minHeight: 360,
  },
  sideHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  panelKicker: {
    margin: 0,
    color: '#93c5fd',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: 900,
  },
  panelTitle: {
    margin: '4px 0 0',
    fontSize: 22,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  form: {
    display: 'grid',
    gap: 14,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  },
  label: {
    display: 'grid',
    gap: 7,
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 800,
  },
  input: {
    width: '100%',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 8,
    background: '#0b1324',
    color: '#e5e7eb',
    padding: '12px 13px',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  compactInput: {
    width: '100%',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: 8,
    background: '#08111f',
    color: '#94a3b8',
    padding: '9px 11px',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
  },
  logoUploader: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 12,
    border: '1px solid rgba(96, 165, 250, 0.22)',
    borderRadius: 8,
    background: '#08111f',
    padding: 12,
  },
  logoPreview: {
    width: 56,
    height: 56,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    background: '#0f1b2e',
    color: '#60a5fa',
    padding: 7,
    boxSizing: 'border-box',
  },
  logoPreviewImage: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'center',
  },
  logoUploadBody: {
    display: 'grid',
    gap: 3,
    minWidth: 0,
  },
  uploadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid rgba(96, 165, 250, 0.34)',
    borderRadius: 8,
    background: '#12315d',
    color: '#dbeafe',
    padding: '10px 12px',
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  hiddenInput: {
    display: 'none',
  },
  range: {
    width: '100%',
    accentColor: '#60a5fa',
  },
  segmented: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  segment: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: '#0b1324',
    color: '#9ca3af',
    borderRadius: 8,
    padding: '11px 12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  segmentActive: {
    background: '#1e3a6b',
    borderColor: '#60a5fa',
    color: '#fff',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 0,
    borderRadius: 8,
    background: '#2f7df4',
    color: '#fff',
    minHeight: 46,
    padding: '12px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  feePill: {
    border: '1px solid rgba(96, 165, 250, 0.35)',
    background: 'rgba(37, 99, 235, 0.18)',
    color: '#bfdbfe',
    borderRadius: 999,
    padding: '7px 10px',
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  configLine: {
    display: 'grid',
    gridTemplateColumns: '18px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(148, 163, 184, 0.12)',
    borderRadius: 8,
    background: '#08111f',
    padding: '10px 12px',
    color: '#a8b3c7',
  },
  launchFacts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  errorLine: {
    margin: 0,
    color: '#fca5a5',
    fontWeight: 800,
  },
  iconButton: {
    width: 40,
    height: 40,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 8,
    background: '#08111f',
    color: '#cbd5e1',
    cursor: 'pointer',
  },
  tokenList: {
    display: 'grid',
    gap: 10,
    maxHeight: 450,
    overflow: 'auto',
  },
  tokenRow: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 10,
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: '#08111f',
    color: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    cursor: 'pointer',
    textAlign: 'left',
  },
  tokenRowActive: {
    borderColor: '#60a5fa',
    background: '#13284a',
  },
  tokenInfo: {
    display: 'grid',
    gap: 3,
    minWidth: 0,
  },
  progressBadge: {
    borderRadius: 999,
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#86efac',
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 900,
  },
  tokenAvatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    objectFit: 'cover',
    background: '#111827',
  },
  tokenAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: '#1e3a6b',
    color: '#bfdbfe',
    fontWeight: 900,
  },
  emptyState: {
    minHeight: 220,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 10,
    color: '#9ca3af',
    textAlign: 'center',
    border: '1px dashed rgba(148, 163, 184, 0.22)',
    borderRadius: 8,
    padding: 18,
  },
  marketGrid: {
    maxWidth: 1280,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)',
    gap: 20,
  },
  detailWrap: {
    maxWidth: 1280,
    margin: '0 auto',
  },
  detailToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  detailActionButton: {
    minHeight: 40,
    padding: '8px 13px',
    borderRadius: 10,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  detailSearch: {
    flex: 1,
    minWidth: 180,
    maxWidth: 260,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: '8px 12px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
  },
  detailSearchInput: {
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    border: 0,
    color: '#fff',
    fontSize: 13,
    outline: 'none',
  },
  miniTokenScroller: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 10,
    marginBottom: 8,
    WebkitOverflowScrolling: 'touch',
  },
  miniTokenCard: {
    flex: '0 0 auto',
    minWidth: 138,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    borderRadius: 10,
    border: '1px solid rgba(59, 130, 246, 0.22)',
    background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.95) 100%)',
    color: '#f8fafc',
    padding: '8px 10px',
    cursor: 'pointer',
  },
  miniTokenCardActive: {
    background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.2) 100%)',
    borderColor: 'rgba(96, 165, 250, 0.55)',
  },
  miniTokenInfo: {
    display: 'grid',
    gap: 1,
    textAlign: 'left',
    minWidth: 0,
  },
  marketChartPanel: {
    background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(59, 130, 246, 0.2)',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  marketChartHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 12,
  },
  marketCapValue: {
    fontSize: 26,
    fontWeight: 900,
    color: '#f8fafc',
    lineHeight: 1,
  },
  marketMuted: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 6,
  },
  marketChartMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 7,
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 700,
  },
  lpProgressWrap: {
    marginBottom: 12,
  },
  lpProgressTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 6,
  },
  chartCanvasWrap: {
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)',
    borderRadius: 12,
    border: '1px solid rgba(59, 130, 246, 0.15)',
    minHeight: 370,
    padding: 8,
    overflow: 'hidden',
    touchAction: 'none',
    position: 'relative',
  },
  chartCanvas: {
    width: '100%',
    height: 350,
    minHeight: 350,
  },
  chartLoading: {
    position: 'absolute',
    inset: 8,
    minHeight: 350,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    color: '#9ca3af',
    fontWeight: 800,
  },
  transactionsPanel: {
    marginTop: 16,
    background: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    border: '1px solid rgba(59, 130, 246, 0.15)',
    overflow: 'hidden',
  },
  transactionsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '12px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    fontSize: 12,
    fontWeight: 800,
    color: '#9ca3af',
  },
  transactionsTable: {
    minWidth: 0,
  },
  transactionHead: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.7fr 1fr 0.9fr 0.8fr',
    gap: 10,
    padding: '10px 14px',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 800,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  transactionRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.7fr 1fr 0.9fr 0.8fr',
    gap: 10,
    padding: '12px 14px',
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 800,
  },
  emptyTransactions: {
    padding: 26,
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 13,
  },
  buyText: {
    color: '#10b981',
  },
  sellText: {
    color: '#ef4444',
  },
  txLink: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontWeight: 800,
  },
  chartPanel: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: '#0d1728',
    borderRadius: 8,
    padding: 20,
  },
  addressPill: {
    color: '#93c5fd',
    background: '#08111f',
    border: '1px solid rgba(96, 165, 250, 0.22)',
    borderRadius: 999,
    padding: '7px 10px',
    fontWeight: 900,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    background: '#0b1324',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    background: '#22c55e',
    borderRadius: 999,
  },
  marketStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
    marginBottom: 16,
  },
  mutedText: {
    color: '#9ca3af',
    lineHeight: 1.5,
    margin: '14px 0 0',
  },
  tradePanel: {
    display: 'grid',
    gap: 14,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: '#0d1728',
    borderRadius: 8,
    padding: 18,
    alignSelf: 'start',
  },
  proTradePanel: {
    display: 'grid',
    gap: 14,
    background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
    borderRadius: 8,
    padding: 16,
    border: '1px solid rgba(59, 130, 246, 0.2)',
    alignSelf: 'start',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  tradeTabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 2,
  },
  tradeTab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    border: '1px solid rgba(59, 130, 246, 0.22)',
    background: 'rgba(255,255,255,0.08)',
    color: '#f8fafc',
    fontWeight: 900,
    fontSize: 15,
    cursor: 'pointer',
  },
  tradeTabBuyActive: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    borderColor: 'rgba(16, 185, 129, 0.55)',
  },
  tradeTabSellActive: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  balanceBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 13,
    background: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 10,
    color: '#9ca3af',
    fontSize: 13,
  },
  balanceCopy: {
    display: 'grid',
    gap: 3,
    minWidth: 0,
  },
  balanceHint: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 800,
  },
  proAmountLabel: {
    display: 'grid',
    gap: 8,
    color: '#cbd5e1',
    fontWeight: 900,
  },
  proAmountBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: 13,
  },
  proAmountInput: {
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    border: 0,
    color: '#fff',
    fontSize: 20,
    fontWeight: 900,
    outline: 'none',
  },
  quickAmountGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 7,
  },
  quickAmountButton: {
    minHeight: 38,
    borderRadius: 8,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#60a5fa',
    fontWeight: 900,
    cursor: 'pointer',
  },
  tradePreview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
    color: '#7f8da5',
    fontSize: 10,
  },
  proTradeButton: {
    width: '100%',
    minHeight: 50,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 12,
    border: 0,
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#fff',
    fontWeight: 900,
    fontSize: 16,
    cursor: 'pointer',
  },
  proSellButton: {
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
  },
  tradeWarning: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(245, 158, 11, 0.28)',
    background: 'rgba(245, 158, 11, 0.1)',
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  tradeFacts: {
    display: 'grid',
    gap: 8,
    marginTop: 2,
  },
  tradeFactsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(0, 0, 0, 0.22)',
    color: '#9ca3af',
    fontSize: 13,
  },
  tradeFactsValue: {
    color: '#f8fafc',
    fontWeight: 900,
    textAlign: 'right',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  launchpadNote: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 800,
  },
  creatorFeePanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid rgba(34, 197, 94, 0.22)',
    background: 'rgba(22, 163, 74, 0.1)',
    borderRadius: 8,
    padding: '12px 13px',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid rgba(96, 165, 250, 0.3)',
    borderRadius: 8,
    background: '#10223d',
    color: '#bfdbfe',
    minHeight: 40,
    padding: '9px 12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
}
