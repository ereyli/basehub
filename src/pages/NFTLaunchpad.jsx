import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Upload, Wand2, Package, AlertCircle, ExternalLink, CheckCircle,
  Coins, Rocket, TrendingUp, TrendingDown, Clock, Image as ImageIcon, X, ZoomIn,
  ArrowUpDown, Flame, Sparkles, Eye
} from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'
import { useNFTLaunchpad } from '../hooks/useNFTLaunchpad'
import { useX402Payment } from '../hooks/useX402Payment'
import { NFT_LAUNCH_COLLECTION_ABI } from '../config/nftCollection'
import { uploadToIPFS } from '../utils/pinata'
import { generateAIImage } from '../utils/aiImageGenerator'
import { supabase } from '../config/supabase'
import { getAddressExplorerUrl, getCollectionMarketUrl, NETWORKS } from '../config/networks'

function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatMintPrice(price) {
  const p = (price ?? '0').toString().trim()
  if (p === '' || Number(p) === 0) return 'Free'
  return `${p} ETH`
}

// Convert IPFS hash to gateway URL
function ipfsToUrl(ipfsHash) {
  if (!ipfsHash) return null
  // If already a full URL, return as-is
  if (ipfsHash.startsWith('http://') || ipfsHash.startsWith('https://')) {
    return ipfsHash
  }
  // If it's an IPFS hash (starts with Qm or bafk), convert to gateway URL
  if (ipfsHash.startsWith('Qm') || ipfsHash.startsWith('bafk')) {
    // Try multiple gateways for better reliability
    const gateways = [
      `https://ipfs.io/ipfs/${ipfsHash}`,
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
    ]
    return gateways[0] // Use first gateway, fallback handled by onError
  }
  return ipfsHash
}

function dataURLtoFile(dataUrl, filename = 'nft-image.png') {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}

/* ───────────────────── Lightbox Component ───────────────────── */
function Lightbox({ src, alt, onClose }) {
  if (!src) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out', animation: 'fadeIn .2s ease',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '20px', right: '20px',
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
          width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', zIndex: 10001,
        }}
      >
        <X size={22} />
      </button>
      <img
        src={src} alt={alt || 'Preview'}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '85vh', borderRadius: '16px',
          objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          cursor: 'default', animation: 'scaleIn .25s ease',
        }}
      />
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  )
}

/* ───────────────────── Image Preview Thumbnail ───────────────────── */
function ImagePreview({ src, alt, onRemove }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  if (!src) return null
  return (
    <>
      {lightboxOpen && <Lightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />}
      <div style={{
        position: 'relative', marginTop: '12px',
        borderRadius: '14px', overflow: 'hidden',
        border: '2px solid rgba(59, 130, 246, 0.4)',
        background: 'rgba(15, 23, 42, 0.6)',
      }}>
        <img
          src={src} alt={alt || 'Preview'}
          onClick={() => setLightboxOpen(true)}
          style={{
            width: '100%', height: '200px', objectFit: 'contain',
            cursor: 'zoom-in', display: 'block',
          }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '12px', color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ZoomIn size={12} /> Click to enlarge
          </span>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              style={{
                background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '8px',
                padding: '4px 10px', color: '#fff', fontSize: '11px', fontWeight: '600',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <X size={12} /> Remove
            </button>
          )}
        </div>
      </div>
    </>
  )
}

/* ───────────────────── Sort Pill ───────────────────── */
function SortPill({ label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
        border: active ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(55,65,81,0.6)',
        background: active ? 'rgba(59,130,246,0.2)' : 'rgba(30,41,59,0.6)',
        color: active ? '#93c5fd' : '#9ca3af',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={12} />} {label}
    </button>
  )
}

/* ───────────────────── Collection Card Image ───────────────────── */
function CollectionCardImage({ imageUrl, name }) {
  const [imageError, setImageError] = useState(false)
  const [imageSrc, setImageSrc] = useState(() => ipfsToUrl(imageUrl))
  
  if (!imageUrl || imageError) {
    return <Package size={48} style={{ color: '#3b82f6', opacity: 0.6 }} />
  }
  
  return (
    <img
      src={imageSrc}
      alt={name}
      onError={() => {
        // Extract IPFS hash from URL
        const hash = imageUrl.replace(/^https?:\/\/[^/]+\/ipfs\//, '').replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '')
        if (hash && hash.length > 10) {
          // Try fallback gateways
          const fallbacks = [
            `https://gateway.pinata.cloud/ipfs/${hash}`,
            `https://cloudflare-ipfs.com/ipfs/${hash}`,
            `https://dweb.link/ipfs/${hash}`,
          ]
          const currentIndex = fallbacks.findIndex(url => imageSrc === url)
          if (currentIndex < fallbacks.length - 1) {
            setImageSrc(fallbacks[currentIndex + 1])
          } else {
            setImageError(true)
          }
        } else {
          setImageError(true)
        }
      }}
      style={{
        maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto',
        borderRadius: '10px', objectFit: 'contain',
      }}
    />
  )
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function NFTLaunchpad() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Tabs – open Explore when coming from Home "Launched Collections" card (?tab=explore)
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get('tab') === 'explore' ? 'explore' : 'create'
  )
  useEffect(() => {
    if (searchParams.get('tab') === 'explore') setActiveTab('explore')
  }, [searchParams])

  // Create form state
  const [imageSource, setImageSource] = useState('upload')
  const [imageFile, setImageFile] = useState(null)
  const [imageFilePreview, setImageFilePreview] = useState(null)
  const [aiImageUrl, setAiImageUrl] = useState(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [supply, setSupply] = useState(1000)
  const [mintPrice, setMintPrice] = useState('0.001')
  const [description, setDescription] = useState('')
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)

  // Collections state
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [countsByChain, setCountsByChain] = useState({ 8453: 0, 57073: 0, 1868: 0, 4326: 0 })
  const [chainStatsByContract, setChainStatsByContract] = useState({})
  const [sortBy, setSortBy] = useState('newest') // newest | most_minted | trending | least_minted | oldest | price_low | price_high | recent_activity
  const [soldOutOnly, setSoldOutOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const NFTS_PER_PAGE = 12

  const errorRef = useRef(null)
  const fileInputRef = useRef(null)
  const { makePayment: makeX402Payment, isLoading: isLoadingX402, error: x402Error, isConnected: isX402Connected } = useX402Payment()
  const {
    createCollection, isLoading: isCreating, loadingStep,
    error: createError, success, contractAddress, deployTxHash, slug: deployedSlug,
    deployFeeEth, isEarlyAccessHolder,
  } = useNFTLaunchpad()

  const getProcessingLabel = () => {
    if (!loadingStep) return 'Processing...'
    if (loadingStep === 'uploading_image') return 'Uploading image to IPFS...'
    if (loadingStep === 'uploading_metadata') return 'Uploading metadata...'
    if (loadingStep === 'deploying') return 'Confirm in wallet (deploy)...'
    return 'Processing...'
  }

  // Fetch deploy counts by network (compact stats row)
  useEffect(() => {
    if (!supabase?.from) return
    let cancelled = false
    Promise.all([
      supabase.from('nft_launchpad_collections').select('*', { count: 'exact', head: true }).or('chain_id.eq.8453,chain_id.is.null'),
      supabase.from('nft_launchpad_collections').select('*', { count: 'exact', head: true }).eq('chain_id', 57073),
      supabase.from('nft_launchpad_collections').select('*', { count: 'exact', head: true }).eq('chain_id', 1868),
      supabase.from('nft_launchpad_collections').select('*', { count: 'exact', head: true }).eq('chain_id', 4326),
    ]).then(([r1, r2, r3, r4]) => {
      if (cancelled) return
      setCountsByChain({
        8453: r1?.count ?? 0,
        57073: r2?.count ?? 0,
        1868: r3?.count ?? 0,
        4326: r4?.count ?? 0,
      })
    })
    return () => { cancelled = true }
  }, [success])

  // Load collections - filter by current chain (Base, Ink or Soneium)
  useEffect(() => {
    if (!supabase?.from) { setCollectionsLoading(false); return }
    let cancelled = false
    let query = supabase
      .from('nft_launchpad_collections')
      .select('contract_address, deployer_address, name, symbol, supply, image_url, mint_price, slug, total_minted, is_active, created_at, chain_id')
      .order('created_at', { ascending: false })
      .limit(100)
    // Filter by chain: Base (8453), Ink (57073), Soneium (1868), MegaETH (4326). Legacy rows have chain_id NULL = treat as Base
    if (chainId === NETWORKS.BASE.chainId) {
      query = query.or('chain_id.eq.8453,chain_id.is.null')
    } else if (chainId === NETWORKS.INKCHAIN.chainId) {
      query = query.eq('chain_id', 57073)
    } else if (chainId === NETWORKS.SONEIUM.chainId) {
      query = query.eq('chain_id', 1868)
    } else if (chainId === NETWORKS.MEGAETH.chainId) {
      query = query.eq('chain_id', 4326)
    }
    query.then(({ data, error }) => {
        if (cancelled) return
        setCollectionsLoading(false)
        if (error) {
          console.error('NFT Launchpad collections fetch failed:', error)
          setCollections([])
          return
        }
        setCollections(data ?? [])
      })
    return () => { cancelled = true }
  }, [success, chainId])

  // Read collection state from chain so SOLD OUT / LIVE status stays accurate.
  useEffect(() => {
    if (!publicClient || collections.length === 0) {
      setChainStatsByContract({})
      return
    }
    let cancelled = false

    const fetchChainStats = async () => {
      const entries = await Promise.all(
        collections.map(async (c) => {
          const contract = c.contract_address
          if (!contract) return null
          try {
            const [totalSupply, maxSupply, saleActive] = await Promise.all([
              publicClient.readContract({
                address: contract,
                abi: NFT_LAUNCH_COLLECTION_ABI,
                functionName: 'totalSupply',
              }),
              publicClient.readContract({
                address: contract,
                abi: NFT_LAUNCH_COLLECTION_ABI,
                functionName: 'maxSupply',
              }),
              publicClient.readContract({
                address: contract,
                abi: NFT_LAUNCH_COLLECTION_ABI,
                functionName: 'saleActive',
              }),
            ])
            return [
              contract.toLowerCase(),
              {
                totalMinted: Number(totalSupply),
                maxSupply: Number(maxSupply),
                saleActive: Boolean(saleActive),
              },
            ]
          } catch (_) {
            return null
          }
        })
      )

      if (cancelled) return
      const nextMap = {}
      entries.forEach((entry) => {
        if (entry) nextMap[entry[0]] = entry[1]
      })
      setChainStatsByContract(nextMap)
    }

    fetchChainStats()
    return () => { cancelled = true }
  }, [collections, publicClient])

  // Filter by sold out then sort
  const filteredCollections = useMemo(() => {
    const getMinted = (c) => {
      const key = c.contract_address?.toLowerCase()
      const chainMinted = key ? chainStatsByContract[key]?.totalMinted : undefined
      return chainMinted ?? Number(c.total_minted || 0)
    }
    const getSupply = (c) => {
      const key = c.contract_address?.toLowerCase()
      const chainSupply = key ? chainStatsByContract[key]?.maxSupply : undefined
      return chainSupply ?? Number(c.supply || 0)
    }

    if (soldOutOnly) {
      return collections.filter((c) => {
        const minted = getMinted(c)
        const supply = getSupply(c)
        return supply > 0 && minted >= supply
      })
    }
    return collections
  }, [collections, soldOutOnly, chainStatsByContract])

  const sortedCollections = useMemo(() => {
    const arr = [...filteredCollections]
    const price = (c) => parseFloat(c.mint_price) || 0
    const minted = (c) => {
      const key = c.contract_address?.toLowerCase()
      const chainMinted = key ? chainStatsByContract[key]?.totalMinted : undefined
      return chainMinted ?? Number(c.total_minted || 0)
    }
    if (sortBy === 'newest') arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    else if (sortBy === 'most_minted') arr.sort((a, b) => minted(b) - minted(a))
    else if (sortBy === 'least_minted') arr.sort((a, b) => minted(a) - minted(b))
    else if (sortBy === 'oldest') arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    else if (sortBy === 'price_low') arr.sort((a, b) => price(a) - price(b))
    else if (sortBy === 'price_high') arr.sort((a, b) => price(b) - price(a))
    else if (sortBy === 'recent_activity') {
      arr.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    }
    else if (sortBy === 'trending') {
      arr.sort((a, b) => {
        const aScore = minted(a) / Math.max(1, (Date.now() - new Date(a.created_at).getTime()) / 3600000)
        const bScore = minted(b) / Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / 3600000)
        return bScore - aScore
      })
    }
    return arr
  }, [filteredCollections, sortBy, chainStatsByContract])

  const totalPages = Math.max(1, Math.ceil(sortedCollections.length / NFTS_PER_PAGE))
  const paginatedCollections = useMemo(() => {
    const start = (currentPage - 1) * NFTS_PER_PAGE
    return sortedCollections.slice(start, start + NFTS_PER_PAGE)
  }, [sortedCollections, currentPage])

  useEffect(() => { setCurrentPage(1) }, [sortBy, soldOutOnly])
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [totalPages, currentPage])

  useEffect(() => {
    if (createError && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [createError])

  // File upload → local preview
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      setAiImageUrl(null)
      const reader = new FileReader()
      reader.onload = (ev) => setImageFilePreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const removeUploadedImage = () => {
    setImageFile(null)
    setImageFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // AI generate
  const handleAiGenerate = async (e) => {
    e.preventDefault()
    if (!aiPrompt.trim() || !isConnected || !isX402Connected) return
    setIsGeneratingAi(true)
    try {
      await makeX402Payment()
      const dataUrl = await generateAIImage(aiPrompt.trim())
      const file = dataURLtoFile(dataUrl, 'ai-nft.png')
      const url = await uploadToIPFS(file)
      setAiImageUrl(url)
    } catch (err) {
      console.error(err)
    } finally {
      setIsGeneratingAi(false)
    }
  }

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !symbol.trim() || supply < 1) return
    if (imageSource === 'upload' && !imageFile) { alert('Please upload an image.'); return }
    if (imageSource === 'ai' && !aiImageUrl) { alert('Generate an AI image first.'); return }
    try {
      await createCollection({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        supply: Number(supply),
        mintPrice: mintPrice || '0',
        imageSource: imageSource === 'upload' ? 'upload' : 'url',
        imageFile: imageSource === 'upload' ? imageFile : undefined,
        imageUrl: imageSource === 'ai' ? aiImageUrl : undefined,
        description: description.trim(),
      })
    } catch (_) {}
  }

  const loading = isCreating || isGeneratingAi || isLoadingX402
  const canDeploy = name.trim() && symbol.trim() && supply >= 1 &&
    ((imageSource === 'upload' && imageFile) || (imageSource === 'ai' && aiImageUrl))

  const currentPreviewUrl = imageSource === 'upload' ? imageFilePreview : aiImageUrl

  /* ─────────── Tab Button ─────────── */
  const TabBtn = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1, padding: '12px 16px',
        background: activeTab === id ? 'rgba(59,130,246,0.15)' : 'transparent',
        border: 'none', borderBottom: activeTab === id ? '2px solid #3b82f6' : '2px solid transparent',
        color: activeTab === id ? '#93c5fd' : '#6b7280',
        fontWeight: '600', fontSize: '14px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        transition: 'all 0.2s',
      }}
    >
      <Icon size={16} /> {label}
    </button>
  )

  return (
    <NetworkGuard showWarning={true}>
      <div className="deploy-token-page">
        <div className="deploy-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 16px' }}>
          <BackButton />

          {/* ─── Header ─── */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(59,130,246,0.3)',
            }}>
              <Rocket size={32} style={{ color: '#60a5fa' }} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
              NFT Launchpad
            </h1>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, maxWidth: '420px', marginInline: 'auto', lineHeight: 1.5 }}>
              Deploy your NFT collection on Base, Ink, Soneium or MegaETH. Set a mint price, get a shareable page, and earn from every mint.
            </p>
            {/* Network deploy counts - compact row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
              {[
                { chainId: 8453, logo: '/base-logo.jpg', label: 'Base' },
                { chainId: 57073, logo: '/ink-logo.jpg', label: 'Ink' },
                { chainId: 1868, logo: '/soneium-logo.jpg', label: 'Soneium' },
                { chainId: 4326, logo: '/megaeth-logo.jpg', label: 'MegaETH' },
              ].map(({ chainId: cid, logo, label }) => (
                <div key={cid} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(30,41,59,0.5)', borderRadius: '10px', border: '1px solid rgba(55,65,81,0.5)' }}>
                  <img src={logo} alt={label} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{countsByChain[cid] ?? 0}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div style={{
            display: 'flex', borderBottom: '1px solid rgba(55,65,81,0.5)',
            marginBottom: '24px', borderRadius: '0',
          }}>
            <TabBtn id="create" label="Create" icon={Sparkles} />
            <TabBtn id="explore" label={`Explore${collections.length ? ` (${collections.length})` : ''}`} icon={Eye} />
          </div>

          {/* ═══════════ CREATE TAB ═══════════ */}
          {activeTab === 'create' && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              {success ? (
                /* ─── Success Card ─── */
                <div style={{
                  padding: '28px', borderRadius: '18px',
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.06))',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '14px',
                      background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CheckCircle size={28} style={{ color: '#22c55e' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#22c55e' }}>Collection Deployed!</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>Your mint page is live</div>
                    </div>
                  </div>
                  <div style={{
                    padding: '12px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '10px',
                    marginBottom: '16px', wordBreak: 'break-all', fontSize: '13px', color: '#cbd5e1',
                    fontFamily: 'monospace',
                  }}>
                    {contractAddress}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {deployedSlug && (
                      <button
                        onClick={() => navigate(`/mint/${deployedSlug}`)}
                        style={{
                          padding: '11px 22px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '14px',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <Rocket size={14} /> Open Mint Page
                      </button>
                    )}
                    <a href={getCollectionMarketUrl(contractAddress, chainId)} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '11px 18px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(55,65,81,0.8)', borderRadius: '12px', color: '#93c5fd', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      OpenSea <ExternalLink size={12} />
                    </a>
                    <a href={getAddressExplorerUrl(chainId, contractAddress)} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '11px 18px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(55,65,81,0.8)', borderRadius: '12px', color: '#93c5fd', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {chainId === NETWORKS.BASE.chainId ? 'Basescan' : chainId === NETWORKS.INKCHAIN.chainId ? 'Ink Explorer' : chainId === NETWORKS.SONEIUM.chainId ? 'Soneium Explorer' : 'MegaETH Explorer'} <ExternalLink size={12} />
                    </a>
                  </div>
                  <p style={{ marginTop: '16px', fontSize: '12px', color: '#64748b' }}>
                    Share the mint page link with your community. Mint revenue goes directly to your wallet.
                  </p>
                </div>
              ) : (
                <>
                  {/* ─── Image Section ─── */}
                  <div style={{
                    padding: '20px', borderRadius: '16px',
                    background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(55,65,81,0.5)',
                    marginBottom: '20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <ImageIcon size={16} style={{ color: '#60a5fa' }} />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>Collection Image</span>
                    </div>

                    {/* Source toggle */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button type="button"
                        onClick={() => { setImageSource('upload'); setAiImageUrl(null) }}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                          border: imageSource === 'upload' ? '1.5px solid #3b82f6' : '1.5px solid rgba(55,65,81,0.6)',
                          background: imageSource === 'upload' ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.5)',
                          color: imageSource === 'upload' ? '#93c5fd' : '#6b7280',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}>
                        <Upload size={14} /> Upload Image
                      </button>
                      <button type="button"
                        onClick={() => { setImageSource('ai'); setImageFile(null); setImageFilePreview(null) }}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                          border: imageSource === 'ai' ? '1.5px solid #8b5cf6' : '1.5px solid rgba(55,65,81,0.6)',
                          background: imageSource === 'ai' ? 'rgba(139,92,246,0.15)' : 'rgba(30,41,59,0.5)',
                          color: imageSource === 'ai' ? '#c4b5fd' : '#6b7280',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}>
                        <Wand2 size={14} /> AI Generate
                      </button>
                    </div>

                    {/* Upload */}
                    {imageSource === 'upload' && (
                      <div>
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            padding: '24px', borderRadius: '12px',
                            border: '2px dashed rgba(59,130,246,0.3)',
                            background: 'rgba(59,130,246,0.05)',
                            textAlign: 'center', cursor: 'pointer',
                            transition: 'border-color 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.6)'}
                          onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'}
                        >
                          <Upload size={24} style={{ color: '#60a5fa', marginBottom: '8px' }} />
                          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                            {imageFile ? imageFile.name : 'Click to select an image (PNG, JPG, GIF)'}
                          </p>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange}
                          style={{ display: 'none' }} />
                        {imageFilePreview && (
                          <ImagePreview src={imageFilePreview} alt="Upload preview" onRemove={removeUploadedImage} />
                        )}
                      </div>
                    )}

                    {/* AI */}
                    {imageSource === 'ai' && (
                      <div>
                        <div style={{
                          padding: '10px 14px', borderRadius: '10px', marginBottom: '12px',
                          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                          fontSize: '12px', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <Coins size={12} /> <strong>0.1 USDC</strong> via x402 payment
                        </div>
                        {x402Error && (
                          <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} /> {x402Error}
                          </div>
                        )}
                        <textarea
                          value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Describe your NFT art... e.g. A futuristic city floating in space, cyberpunk style"
                          maxLength={300}
                          style={{
                            width: '100%', padding: '12px', borderRadius: '10px', fontSize: '13px',
                            border: '1.5px solid rgba(55,65,81,0.6)', background: 'rgba(15,23,42,0.6)',
                            color: '#e2e8f0', minHeight: '72px', resize: 'vertical', boxSizing: 'border-box',
                          }}
                        />
                        <button type="button" onClick={handleAiGenerate}
                          disabled={!aiPrompt.trim() || !isConnected || !isX402Connected || isGeneratingAi || isLoadingX402}
                          style={{
                            marginTop: '10px', padding: '10px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
                            background: (!aiPrompt.trim() || isGeneratingAi || isLoadingX402) ? '#374151' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                            color: '#fff', border: 'none',
                            cursor: (!aiPrompt.trim() || isGeneratingAi || isLoadingX402) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}>
                          <Wand2 size={14} />
                          {isLoadingX402 ? 'Processing payment...' : isGeneratingAi ? 'Generating...' : 'Generate (0.1 USDC)'}
                        </button>
                        {aiImageUrl && (
                          <ImagePreview src={aiImageUrl} alt="AI generated" onRemove={() => setAiImageUrl(null)} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* ─── Form ─── */}
                  <form onSubmit={handleSubmit}>
                    <div style={{
                      padding: '20px', borderRadius: '16px',
                      background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(55,65,81,0.5)',
                      marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <Package size={16} style={{ color: '#60a5fa' }} />
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>Collection Details</span>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Collection Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My NFT Collection" required maxLength={32}
                          style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(55,65,81,0.6)', borderRadius: '10px', fontSize: '14px', background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', boxSizing: 'border-box' }} />
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Symbol</label>
                          <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="MNFT" required maxLength={10}
                            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(55,65,81,0.6)', borderRadius: '10px', fontSize: '14px', background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Max Supply</label>
                          <input type="number" min={1} max={100000} value={supply} onChange={(e) => setSupply(Number(e.target.value) || 1)}
                            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(55,65,81,0.6)', borderRadius: '10px', fontSize: '14px', background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', boxSizing: 'border-box' }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Mint Price (ETH)</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setMintPrice('0')}
                            style={{
                              padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                              background: (mintPrice === '0' || mintPrice === '' || Number(mintPrice) === 0) ? 'rgba(34,197,94,0.25)' : 'rgba(55,65,81,0.5)',
                              color: (mintPrice === '0' || mintPrice === '' || Number(mintPrice) === 0) ? '#4ade80' : '#94a3b8',
                              border: (mintPrice === '0' || mintPrice === '' || Number(mintPrice) === 0) ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(55,65,81,0.6)',
                              cursor: 'pointer',
                            }}>
                            Free
                          </button>
                          <input type="text" value={mintPrice} onChange={(e) => setMintPrice(e.target.value)} placeholder="0.005"
                            style={{ flex: 1, minWidth: '120px', padding: '11px 14px', border: '1.5px solid rgba(55,65,81,0.6)', borderRadius: '10px', fontSize: '14px', background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', boxSizing: 'border-box' }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Description <span style={{ color: '#475569' }}>(optional)</span></label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell people about your collection..." maxLength={200}
                          style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(55,65,81,0.6)', borderRadius: '10px', fontSize: '13px', background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', minHeight: '56px', resize: 'vertical', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    {/* ─── Info Box ─── */}
                    <div style={{
                      padding: '14px 16px', borderRadius: '12px', marginBottom: '16px',
                      background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '13px', fontWeight: '700', color: '#93c5fd' }}>
                        <Coins size={14} /> How it works
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.7 }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ color: '#475569' }}>1.</span> Deploy fee: <strong style={{ color: '#e2e8f0' }}>{deployFeeEth} ETH</strong>
                          {isEarlyAccessHolder ? (
                            <span style={{ color: '#22c55e', marginLeft: '4px' }}>(Early Access discount)</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}> — <a href="/early-access" style={{ color: '#93c5fd' }}>Hold Early Access Pass</a> for 0.0005 ETH</span>
                          )}
                          <span style={{ color: '#64748b' }}> (one-time)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ color: '#475569' }}>2.</span> Each mint at <strong style={{ color: '#e2e8f0' }}>{formatMintPrice(mintPrice)}</strong> goes <strong style={{ color: '#22c55e' }}>directly to you</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ color: '#475569' }}>3.</span> A shareable mint page is auto-created for your collection
                        </div>
                      </div>
                    </div>

                    {/* ─── Preview Card ─── */}
                    {currentPreviewUrl && name.trim() && (
                      <div style={{
                        padding: '14px', borderRadius: '14px', marginBottom: '16px',
                        background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(55,65,81,0.4)',
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                          Preview
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <img src={currentPreviewUrl} alt="Preview" style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover' }} />
                          <div>
                            <div style={{ fontWeight: '700', color: '#e2e8f0', fontSize: '15px' }}>{name.trim()}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{symbol || '???'} · {formatMintPrice(mintPrice)} · {supply} supply</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {(createError || x402Error) && (
                      <div ref={errorRef} role="alert" style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '12px', marginBottom: '16px', color: '#fca5a5', fontSize: '13px',
                      }}>
                        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>{createError || x402Error}</span>
                      </div>
                    )}

                    {/* Deploy button */}
                    <button type="submit" disabled={loading || !canDeploy}
                      style={{
                        width: '100%', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: '700',
                        background: canDeploy && !loading ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#1e293b',
                        color: canDeploy && !loading ? '#fff' : '#475569',
                        border: canDeploy && !loading ? 'none' : '1px solid rgba(55,65,81,0.5)',
                        cursor: canDeploy && !loading ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        transition: 'all 0.2s',
                      }}>
                      {loading ? (
                        <>{getProcessingLabel()}</>
                      ) : (
                        <><Rocket size={16} /> Deploy Collection ({deployFeeEth} ETH)</>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* ═══════════ EXPLORE TAB ═══════════ */}
          {activeTab === 'explore' && (
            <div>
              {/* Sort bar */}
              <div style={{
                display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap',
                alignItems: 'center',
              }}>
                <ArrowUpDown size={14} style={{ color: '#64748b' }} />
                <SortPill label="Newest" icon={Clock} active={sortBy === 'newest'} onClick={() => { setSortBy('newest'); setSoldOutOnly(false); }} />
                <SortPill label="Recently active" icon={Sparkles} active={sortBy === 'recent_activity'} onClick={() => { setSortBy('recent_activity'); setSoldOutOnly(false); }} />
                <SortPill label="Most Minted" icon={TrendingUp} active={sortBy === 'most_minted'} onClick={() => { setSortBy('most_minted'); setSoldOutOnly(false); }} />
                <SortPill label="Least Minted" icon={TrendingDown} active={sortBy === 'least_minted'} onClick={() => { setSortBy('least_minted'); setSoldOutOnly(false); }} />
                <SortPill label="Trending" icon={Flame} active={sortBy === 'trending'} onClick={() => { setSortBy('trending'); setSoldOutOnly(false); }} />
                <SortPill label="Oldest" icon={Clock} active={sortBy === 'oldest'} onClick={() => { setSortBy('oldest'); setSoldOutOnly(false); }} />
                <SortPill label="Price: Low" icon={Coins} active={sortBy === 'price_low'} onClick={() => { setSortBy('price_low'); setSoldOutOnly(false); }} />
                <SortPill label="Price: High" icon={Coins} active={sortBy === 'price_high'} onClick={() => { setSortBy('price_high'); setSoldOutOnly(false); }} />
                <SortPill label="Sold out" icon={CheckCircle} active={soldOutOnly} onClick={() => setSoldOutOnly(true)} />
              </div>

              {soldOutOnly && (
                <div style={{ marginBottom: '16px', fontSize: '13px', color: '#94a3b8' }}>
                  {sortedCollections.length === 0
                    ? 'No sold out collections yet.'
                    : `Showing ${sortedCollections.length} sold out collection${sortedCollections.length === 1 ? '' : 's'}.`}
                </div>
              )}

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  flex: 1, padding: '14px', borderRadius: '14px', textAlign: 'center',
                  background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(55,65,81,0.4)',
                }}>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#e2e8f0' }}>{collections.length}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Collections</div>
                </div>
                <div style={{
                  flex: 1, padding: '14px', borderRadius: '14px', textAlign: 'center',
                  background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(55,65,81,0.4)',
                }}>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#e2e8f0' }}>
                    {collections.reduce((sum, c) => {
                      const key = c.contract_address?.toLowerCase()
                      const chainMinted = key ? chainStatsByContract[key]?.totalMinted : undefined
                      return sum + (chainMinted ?? Number(c.total_minted || 0))
                    }, 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Total Minted</div>
                </div>
              </div>

              {/* Collections grid */}
              {collectionsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>Loading collections...</div>
              ) : sortedCollections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <Package size={40} style={{ color: '#334155', marginBottom: '12px' }} />
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                    {soldOutOnly ? 'No sold out collections yet.' : 'No collections yet. Be the first to launch!'}
                  </p>
                  {!soldOutOnly && (
                    <button onClick={() => setActiveTab('create')} style={{
                      marginTop: '16px', padding: '10px 20px', background: '#3b82f6', color: '#fff',
                      border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                    }}>
                      Create Collection
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                  }}>
                    {paginatedCollections.map((c) => {
                      const stats = chainStatsByContract[c.contract_address?.toLowerCase()]
                      const minted = stats?.totalMinted ?? Number(c.total_minted || 0)
                      const total = stats?.maxSupply ?? Number(c.supply || 0)
                      const saleActive = stats?.saleActive ?? Boolean(c.is_active)
                      const pct = total > 0 ? Math.min(100, Math.round((minted / total) * 100)) : 0
                      const isSoldOut = minted >= total && total > 0
                      return (
                        <div
                          key={c.contract_address}
                          onClick={() => c.slug && navigate(`/mint/${c.slug}`)}
                          style={{
                            background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.95) 100%)',
                            borderRadius: '16px',
                            padding: '0',
                            cursor: c.slug ? 'pointer' : 'default',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            transition: 'all 0.3s ease',
                            overflow: 'hidden',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)'
                            e.currentTarget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.2)'
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = 'none'
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)'
                          }}
                        >
                          {/* Progress bar at top */}
                          <div style={{ height: '3px', background: 'rgba(59, 130, 246, 0.2)' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: isSoldOut ? '#f87171' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          {/* Image – contain so full logo is visible, not cropped */}
                          <div style={{
                            padding: '12px 14px 0',
                            height: '160px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(15,23,42,0.5)',
                            borderRadius: '12px',
                            margin: '0 14px',
                          }}>
                            <CollectionCardImage imageUrl={c.image_url} name={c.name} />
                          </div>
                          {/* Info */}
                          <div style={{ padding: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ fontWeight: '700', fontSize: '16px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.name}
                              </span>
                              {isSoldOut && (
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: 'rgba(239,68,68,0.2)', color: '#f87171', flexShrink: 0 }}>SOLD OUT</span>
                              )}
                              {!isSoldOut && saleActive && minted > 0 && (
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: 'rgba(34,197,94,0.2)', color: '#4ade80', flexShrink: 0 }}>LIVE</span>
                              )}
                              {!isSoldOut && saleActive && minted === 0 && (
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', flexShrink: 0 }}>NEW</span>
                              )}
                              {!isSoldOut && !saleActive && (
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', flexShrink: 0 }}>PAUSED</span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                              {c.symbol} · <strong style={{ color: '#94a3b8' }}>{formatMintPrice(c.mint_price)}</strong> · {timeAgo(c.created_at)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                              <span>Minted</span>
                              <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{minted}/{total}</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(55,65,81,0.6)', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: isSoldOut ? '#f87171' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                borderRadius: '3px', transition: 'width 0.3s',
                              }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                      marginTop: '24px', flexWrap: 'wrap', paddingBottom: '16px',
                    }}>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                          padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)',
                          background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.15)',
                          color: currentPage === 1 ? '#6b7280' : '#60a5fa', fontWeight: '600', fontSize: '14px',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ←
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          style={{
                            minWidth: '36px', padding: '8px 10px', borderRadius: '8px',
                            border: currentPage === page ? '1px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
                            background: currentPage === page ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(0, 0, 0, 0.2)',
                            color: currentPage === page ? '#fff' : '#9ca3af', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                          }}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)',
                          background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.15)',
                          color: currentPage === totalPages ? '#6b7280' : '#60a5fa', fontWeight: '600', fontSize: '14px',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </NetworkGuard>
  )
}
