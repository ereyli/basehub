import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Wand2, Package, AlertCircle, ExternalLink, CheckCircle,
  Coins, Rocket, TrendingUp, Clock, Image as ImageIcon, X, ZoomIn,
  ArrowUpDown, Flame, Sparkles, Eye
} from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'
import { useNFTLaunchpad } from '../hooks/useNFTLaunchpad'
import { useX402Payment } from '../hooks/useX402Payment'
import { uploadToIPFS } from '../utils/pinata'
import { generateAIImage } from '../utils/aiImageGenerator'
import { supabase } from '../config/supabase'

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
            width: '100%', height: '200px', objectFit: 'cover',
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

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function NFTLaunchpad() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  // Tabs
  const [activeTab, setActiveTab] = useState('create') // 'create' | 'explore'

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
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'most_minted' | 'trending'

  const errorRef = useRef(null)
  const fileInputRef = useRef(null)
  const { makePayment: makeX402Payment, isLoading: isLoadingX402, error: x402Error, isConnected: isX402Connected } = useX402Payment()
  const {
    createCollection, isLoading: isCreating, loadingStep,
    error: createError, success, contractAddress, deployTxHash, slug: deployedSlug,
  } = useNFTLaunchpad()

  const getProcessingLabel = () => {
    if (!loadingStep) return 'Processing...'
    if (loadingStep === 'uploading_image') return 'Uploading image to IPFS...'
    if (loadingStep === 'uploading_metadata') return 'Uploading metadata...'
    if (loadingStep === 'deploying') return 'Confirm in wallet (deploy)...'
    return 'Processing...'
  }

  // Load collections
  useEffect(() => {
    if (!supabase?.from) { setCollectionsLoading(false); return }
    let cancelled = false
    supabase
      .from('nft_launchpad_collections')
      .select('contract_address, deployer_address, name, symbol, supply, image_url, mint_price, slug, total_minted, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return
        setCollectionsLoading(false)
        if (!error && data) setCollections(data)
      })
    return () => { cancelled = true }
  }, [success])

  // Sorted collections
  const sortedCollections = useMemo(() => {
    const arr = [...collections]
    if (sortBy === 'newest') arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    else if (sortBy === 'most_minted') arr.sort((a, b) => (b.total_minted || 0) - (a.total_minted || 0))
    else if (sortBy === 'trending') {
      arr.sort((a, b) => {
        const aScore = (a.total_minted || 0) / Math.max(1, (Date.now() - new Date(a.created_at).getTime()) / 3600000)
        const bScore = (b.total_minted || 0) / Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / 3600000)
        return bScore - aScore
      })
    }
    return arr
  }, [collections, sortBy])

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
        <div className="deploy-container" style={{ maxWidth: '640px' }}>
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
              Deploy your NFT collection on Base. Set a mint price, get a shareable page, and earn from every mint.
            </p>
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
            <>
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
                    <a href={`https://opensea.io/assets/base/${contractAddress}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '11px 18px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(55,65,81,0.8)', borderRadius: '12px', color: '#93c5fd', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      OpenSea <ExternalLink size={12} />
                    </a>
                    <a href={`https://basescan.org/address/${contractAddress}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '11px 18px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(55,65,81,0.8)', borderRadius: '12px', color: '#93c5fd', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      Basescan <ExternalLink size={12} />
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
                        <input type="text" value={mintPrice} onChange={(e) => setMintPrice(e.target.value)} placeholder="0.005"
                          style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(55,65,81,0.6)', borderRadius: '10px', fontSize: '14px', background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', boxSizing: 'border-box' }} />
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
                          <span style={{ color: '#475569' }}>1.</span> Deploy fee: <strong style={{ color: '#e2e8f0' }}>0.002 ETH</strong> (one-time platform fee)
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ color: '#475569' }}>2.</span> Each mint at <strong style={{ color: '#e2e8f0' }}>{mintPrice || '0'} ETH</strong> goes <strong style={{ color: '#22c55e' }}>directly to you</strong>
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
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{symbol || '???'} · {mintPrice || '0'} ETH · {supply} supply</div>
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
                        <><Rocket size={16} /> Deploy Collection (0.002 ETH)</>
                      )}
                    </button>
                  </form>
                </>
              )}
            </>
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
                <SortPill label="Newest" icon={Clock} active={sortBy === 'newest'} onClick={() => setSortBy('newest')} />
                <SortPill label="Most Minted" icon={TrendingUp} active={sortBy === 'most_minted'} onClick={() => setSortBy('most_minted')} />
                <SortPill label="Trending" icon={Flame} active={sortBy === 'trending'} onClick={() => setSortBy('trending')} />
              </div>

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
                    {collections.reduce((s, c) => s + (c.total_minted || 0), 0)}
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
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No collections yet. Be the first to launch!</p>
                  <button onClick={() => setActiveTab('create')} style={{
                    marginTop: '16px', padding: '10px 20px', background: '#3b82f6', color: '#fff',
                    border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                  }}>
                    Create Collection
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedCollections.map((c) => {
                    const minted = c.total_minted || 0
                    const total = c.supply || 0
                    const pct = total > 0 ? Math.min(100, Math.round((minted / total) * 100)) : 0
                    const isSoldOut = minted >= total && total > 0
                    return (
                      <div
                        key={c.contract_address}
                        onClick={() => c.slug && navigate(`/mint/${c.slug}`)}
                        style={{
                          display: 'flex', gap: '14px', padding: '14px',
                          background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(55,65,81,0.4)',
                          borderRadius: '14px', cursor: c.slug ? 'pointer' : 'default',
                          transition: 'all 0.2s', alignItems: 'center',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.background = 'rgba(15,23,42,0.8)' }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(55,65,81,0.4)'; e.currentTarget.style.background = 'rgba(15,23,42,0.5)' }}
                      >
                        {/* Image */}
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.name}
                            style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: '60px', height: '60px', borderRadius: '12px', flexShrink: 0,
                            background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Package size={24} style={{ color: '#3b82f6' }} />
                          </div>
                        )}

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontWeight: '700', fontSize: '14px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name}
                            </span>
                            {isSoldOut && (
                              <span style={{
                                padding: '1px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700',
                                background: 'rgba(239,68,68,0.15)', color: '#f87171',
                              }}>SOLD OUT</span>
                            )}
                            {!isSoldOut && minted > 0 && (
                              <span style={{
                                padding: '1px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700',
                                background: 'rgba(34,197,94,0.15)', color: '#4ade80',
                              }}>LIVE</span>
                            )}
                            {!isSoldOut && minted === 0 && (
                              <span style={{
                                padding: '1px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700',
                                background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                              }}>NEW</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                            {c.symbol} · <strong style={{ color: '#94a3b8' }}>{c.mint_price || '0'} ETH</strong> · {shortAddress(c.deployer_address)} · {timeAgo(c.created_at)}
                          </div>
                          {/* Progress bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '5px', background: 'rgba(55,65,81,0.6)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: isSoldOut ? '#f87171' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                borderRadius: '3px', transition: 'width 0.3s',
                              }} />
                            </div>
                            <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', fontWeight: '600' }}>
                              {minted}/{total}
                            </span>
                          </div>
                        </div>

                        <ExternalLink size={16} style={{ color: '#475569', flexShrink: 0 }} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </NetworkGuard>
  )
}
