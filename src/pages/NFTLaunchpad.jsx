import React, { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { Upload, Wand2, Package, AlertCircle, ExternalLink, CheckCircle, List, Coins } from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'
import { useNFTLaunchpad } from '../hooks/useNFTLaunchpad'
import { useX402Payment } from '../hooks/useX402Payment'
import { uploadToIPFS } from '../utils/pinata'
import { generateAIImage } from '../utils/aiImageGenerator'
import { supabase } from '../config/supabase'

const OPENSEA_BASE_URL = 'https://opensea.io/assets/base'

function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
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

export default function NFTLaunchpad() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const [imageSource, setImageSource] = useState('upload')
  const [imageFile, setImageFile] = useState(null)
  const [aiImageUrl, setAiImageUrl] = useState(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [supply, setSupply] = useState(1000)
  const [mintPrice, setMintPrice] = useState('0.001')
  const [description, setDescription] = useState('')
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)

  const errorRef = useRef(null)
  const { makePayment: makeX402Payment, isLoading: isLoadingX402, error: x402Error, isConnected: isX402Connected } = useX402Payment()
  const {
    createCollection,
    isLoading: isCreating,
    loadingStep,
    error: createError,
    success,
    contractAddress,
    deployTxHash,
    slug: deployedSlug,
  } = useNFTLaunchpad()

  const getProcessingLabel = () => {
    if (!loadingStep) return 'Processing...'
    if (loadingStep === 'uploading_image') return 'Uploading image to IPFS...'
    if (loadingStep === 'uploading_metadata') return 'Uploading metadata...'
    if (loadingStep === 'deploying') return 'Confirm in wallet (deploy collection)...'
    return 'Processing...'
  }

  // Load collections from Supabase
  useEffect(() => {
    if (!supabase?.from) {
      setCollectionsLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('nft_launchpad_collections')
      .select('contract_address, deployer_address, name, symbol, supply, image_url, mint_price, slug, total_minted, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        setCollectionsLoading(false)
        if (!error && data) setCollections(data)
      })
    return () => { cancelled = true }
  }, [success])

  useEffect(() => {
    if (createError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [createError])

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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      setAiImageUrl(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !symbol.trim() || supply < 1) return
    if (imageSource === 'upload' && !imageFile) {
      alert('Please upload an image or generate one with AI.')
      return
    }
    if (imageSource === 'ai' && !aiImageUrl) {
      alert('Please generate an AI image first (pay 0.1 USDC).')
      return
    }
    try {
      if (imageSource === 'upload') {
        await createCollection({
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          supply: Number(supply),
          mintPrice: mintPrice || '0',
          imageSource: 'upload',
          imageFile,
          description: description.trim(),
        })
      } else {
        await createCollection({
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          supply: Number(supply),
          mintPrice: mintPrice || '0',
          imageSource: 'url',
          imageUrl: aiImageUrl,
          description: description.trim(),
        })
      }
    } catch (_) {
      // error set in hook
    }
  }

  const loading = isCreating || isGeneratingAi || isLoadingX402
  const canDeploy =
    name.trim() &&
    symbol.trim() &&
    supply >= 1 &&
    ((imageSource === 'upload' && imageFile) || (imageSource === 'ai' && aiImageUrl))

  return (
    <NetworkGuard showWarning={true}>
      <div className="deploy-token-page">
        <div className="deploy-container">
          <BackButton />

          <div className="deploy-header">
            <div className="deploy-icon">
              <Package size={48} style={{ color: '#3b82f6' }} />
            </div>
            <h1>NFT Launchpad</h1>
            <p>Create your own NFT collection with a public mint page. Set a price, deploy on Base, and share your mint link.</p>
          </div>

          {success ? (
            <div
              style={{
                padding: '24px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '16px',
                marginTop: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <CheckCircle size={32} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#22c55e' }}>
                  Collection deployed!
                </span>
              </div>
              <p style={{ marginBottom: '8px', color: '#e5e7eb' }}>
                Contract: <code style={{ wordBreak: 'break-all' }}>{contractAddress}</code>
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {deployedSlug && (
                  <button
                    onClick={() => navigate(`/mint/${deployedSlug}`)}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Open Mint Page <ExternalLink size={14} />
                  </button>
                )}
                <a
                  href={`https://opensea.io/assets/base/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 0' }}
                >
                  View on OpenSea <ExternalLink size={14} />
                </a>
                <a
                  href={`https://basescan.org/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 0' }}
                >
                  Basescan <ExternalLink size={14} />
                </a>
                {deployTxHash && (
                  <a
                    href={`https://basescan.org/tx/${deployTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 0' }}
                  >
                    Deploy tx <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                Share the mint page link with your community! Mint revenue goes directly to your wallet.
              </p>
            </div>
          ) : (
            <>
              {/* Image source selector */}
              <div className="form-group">
                <label>Image source</label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => { setImageSource('upload'); setImageFile(null); setAiImageUrl(null) }}
                    style={{
                      flex: 1, padding: '12px 16px',
                      border: `2px solid ${imageSource === 'upload' ? '#3b82f6' : '#374151'}`,
                      borderRadius: '12px',
                      background: imageSource === 'upload' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                      color: imageSource === 'upload' ? '#93c5fd' : '#9ca3af',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px',
                    }}
                  >
                    <Upload size={16} /> Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImageSource('ai'); setImageFile(null) }}
                    style={{
                      flex: 1, padding: '12px 16px',
                      border: `2px solid ${imageSource === 'ai' ? '#3b82f6' : '#374151'}`,
                      borderRadius: '12px',
                      background: imageSource === 'ai' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                      color: imageSource === 'ai' ? '#93c5fd' : '#9ca3af',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px',
                    }}
                  >
                    <Wand2 size={16} /> AI (0.1 USDC)
                  </button>
                </div>
              </div>

              {/* Upload panel */}
              {imageSource === 'upload' && (
                <div className="form-group">
                  <label>Image file</label>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ padding: '8px', color: '#e5e7eb' }} />
                  {imageFile && (
                    <small style={{ color: '#9ca3af', display: 'block', marginTop: '8px' }}>Selected: {imageFile.name}</small>
                  )}
                </div>
              )}

              {/* AI panel */}
              {imageSource === 'ai' && (
                <div className="form-group">
                  <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '12px', fontSize: '13px', color: '#93c5fd' }}>
                    <strong>AI image: 0.1 USDC (x402)</strong> – Payment is required before generating.
                  </div>
                  {x402Error && (
                    <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', fontSize: '14px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} /> {x402Error}
                    </div>
                  )}
                  <label>AI prompt</label>
                  <textarea
                    value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. A cute cat wearing a crown, digital art"
                    style={{ padding: '12px', border: '2px solid #374151', borderRadius: '12px', fontSize: '14px', minHeight: '80px', background: 'rgba(30, 41, 59, 0.8)', color: '#e5e7eb' }}
                    maxLength={300}
                  />
                  <button
                    type="button" onClick={handleAiGenerate}
                    disabled={!aiPrompt.trim() || !isConnected || !isX402Connected || isGeneratingAi || isLoadingX402}
                    style={{ marginTop: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: isGeneratingAi || isLoadingX402 ? 'not-allowed' : 'pointer' }}
                  >
                    {isLoadingX402 ? 'Processing payment...' : isGeneratingAi ? 'Generating...' : 'Generate image (Pay 0.1 USDC)'}
                  </button>
                  {aiImageUrl && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', color: '#86efac' }}>
                      Image ready. Set collection details below and click Deploy.
                    </div>
                  )}
                </div>
              )}

              {/* Collection form */}
              <form onSubmit={handleSubmit} className="deploy-form">
                <div className="form-group">
                  <label>Collection name</label>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="My NFT Collection" required maxLength={32}
                    style={{ padding: '12px 16px', border: '2px solid #374151', borderRadius: '12px', fontSize: '16px', background: 'rgba(30, 41, 59, 0.8)', color: '#e5e7eb' }}
                  />
                </div>
                <div className="form-group">
                  <label>Symbol</label>
                  <input
                    type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="MNFT" required maxLength={10}
                    style={{ padding: '12px 16px', border: '2px solid #374151', borderRadius: '12px', fontSize: '16px', background: 'rgba(30, 41, 59, 0.8)', color: '#e5e7eb' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Max Supply</label>
                    <input
                      type="number" min={1} max={100000} value={supply}
                      onChange={(e) => setSupply(Number(e.target.value) || 1)}
                      style={{ padding: '12px 16px', border: '2px solid #374151', borderRadius: '12px', fontSize: '16px', background: 'rgba(30, 41, 59, 0.8)', color: '#e5e7eb' }}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Mint Price (ETH)</label>
                    <input
                      type="text" value={mintPrice}
                      onChange={(e) => setMintPrice(e.target.value)}
                      placeholder="0.005"
                      style={{ padding: '12px 16px', border: '2px solid #374151', borderRadius: '12px', fontSize: '16px', background: 'rgba(30, 41, 59, 0.8)', color: '#e5e7eb' }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description (optional)</label>
                  <input
                    type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description for your collection"
                    style={{ padding: '12px 16px', border: '2px solid #374151', borderRadius: '12px', fontSize: '14px', background: 'rgba(30, 41, 59, 0.8)', color: '#e5e7eb' }}
                  />
                </div>

                {/* Info box */}
                <div style={{
                  padding: '12px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px', marginBottom: '16px', fontSize: '13px', color: '#93c5fd',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Coins size={14} /> <strong>How it works</strong>
                  </div>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0, lineHeight: 1.6 }}>
                    <li>Deploy fee: <strong>0.002 ETH</strong> (platform fee)</li>
                    <li>Mint price ({mintPrice || '0'} ETH) goes <strong>directly to your wallet</strong></li>
                    <li>A shareable mint page will be created for your collection</li>
                  </ul>
                </div>

                {(createError || x402Error) && (
                  <div
                    ref={errorRef} role="alert"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '12px', marginBottom: '16px', color: '#fca5a5' }}
                  >
                    <AlertCircle size={20} style={{ flexShrink: 0 }} />
                    <span>{createError || x402Error}</span>
                  </div>
                )}

                <button
                  type="submit" disabled={loading || !canDeploy}
                  style={{
                    width: '100%', padding: '16px',
                    background: canDeploy && !loading ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#374151',
                    color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600',
                    cursor: canDeploy && !loading ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loading ? getProcessingLabel() : 'Deploy Collection (0.002 ETH)'}
                </button>
              </form>
            </>
          )}

          {/* --- Collections list --- */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(55, 65, 81, 0.5)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e5e7eb', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <List size={20} /> Live Collections
            </h2>
            {collectionsLoading ? (
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading...</p>
            ) : collections.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>No collections deployed yet. Be the first!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {collections.map((c) => {
                  const minted = c.total_minted || 0
                  const total = c.supply || 0
                  const pct = total > 0 ? Math.min(100, Math.round((minted / total) * 100)) : 0
                  return (
                    <div
                      key={c.contract_address}
                      onClick={() => c.slug && navigate(`/mint/${c.slug}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 16px',
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(55, 65, 81, 0.8)',
                        borderRadius: '14px',
                        cursor: c.slug ? 'pointer' : 'default',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'; e.currentTarget.style.background = 'rgba(30, 41, 59, 1)' }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.8)'; e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)' }}
                    >
                      {/* Collection image */}
                      {c.image_url ? (
                        <img
                          src={c.image_url} alt={c.name}
                          style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={24} style={{ color: '#60a5fa' }} />
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '15px', color: '#e5e7eb', marginBottom: '4px' }}>{c.name}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                          {c.symbol} · {c.mint_price || '0'} ETH · by {shortAddress(c.deployer_address)}
                        </div>
                        {/* Progress bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(55, 65, 81, 0.8)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '3px', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{minted}/{total}</span>
                        </div>
                      </div>

                      <ExternalLink size={18} style={{ color: '#60a5fa', flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </NetworkGuard>
  )
}
