import React, { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Upload, Wand2, Package, AlertCircle, ExternalLink, CheckCircle } from 'lucide-react'
import BackButton from '../components/BackButton'
import NetworkGuard from '../components/NetworkGuard'
import { useNFTLaunchpad } from '../hooks/useNFTLaunchpad'
import { useX402Payment } from '../hooks/useX402Payment'
import { uploadToIPFS } from '../utils/pinata'
import { generateAIImage } from '../utils/aiImageGenerator'

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
  const [imageSource, setImageSource] = useState('upload') // 'upload' | 'ai'
  const [imageFile, setImageFile] = useState(null)
  const [aiImageUrl, setAiImageUrl] = useState(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [supply, setSupply] = useState(100)
  const [description, setDescription] = useState('')
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)

  const errorRef = useRef(null)
  const { makePayment: makeX402Payment, isLoading: isLoadingX402, error: x402Error, isConnected: isX402Connected } = useX402Payment()
  const {
    createCollection,
    isLoading: isCreating,
    error: createError,
    success,
    contractAddress,
    deployTxHash,
    mintTxHash,
  } = useNFTLaunchpad()

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
      // Step 1: x402 payment (0.1 USDC) – same flow as AI NFT Mint
      await makeX402Payment()
      // Step 2: Generate image after payment
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
    if (!name.trim() || !symbol.trim() || supply < 1 || supply > 100) return
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
          imageSource: 'upload',
          imageFile,
          description: description.trim(),
        })
      } else {
        await createCollection({
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          supply: Number(supply),
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
    supply <= 100 &&
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
            <p>Create your own NFT collection. Upload art or generate with AI, then deploy on Base.</p>
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
                  Collection deployed
                </span>
              </div>
              <p style={{ marginBottom: '8px', color: '#e5e7eb' }}>
                Contract: <code style={{ wordBreak: 'break-all' }}>{contractAddress}</code>
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <a
                  href={`https://basescan.org/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  View on Basescan <ExternalLink size={14} />
                </a>
                {deployTxHash && (
                  <a
                    href={`https://basescan.org/tx/${deployTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    Deploy tx <ExternalLink size={14} />
                  </a>
                )}
                {mintTxHash && (
                  <a
                    href={`https://basescan.org/tx/${mintTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    Mint tx <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <p style={{ marginTop: '16px', fontSize: '13px', color: '#9ca3af' }}>
                Deploy fee: 0.002 ETH. AI image: 0.1 USDC (x402).
              </p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Image source</label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setImageSource('upload')
                      setImageFile(null)
                      setAiImageUrl(null)
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: `2px solid ${imageSource === 'upload' ? '#3b82f6' : '#374151'}`,
                      borderRadius: '12px',
                      background: imageSource === 'upload' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                      color: imageSource === 'upload' ? '#93c5fd' : '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '14px',
                    }}
                  >
                    <Upload size={16} />
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageSource('ai')
                      setImageFile(null)
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: `2px solid ${imageSource === 'ai' ? '#3b82f6' : '#374151'}`,
                      borderRadius: '12px',
                      background: imageSource === 'ai' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                      color: imageSource === 'ai' ? '#93c5fd' : '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '14px',
                    }}
                  >
                    <Wand2 size={16} />
                    AI (0.1 USDC)
                  </button>
                </div>
              </div>

              {imageSource === 'upload' && (
                <div className="form-group">
                  <label>Image file</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ padding: '8px', color: '#e5e7eb' }}
                  />
                  {imageFile && (
                    <small style={{ color: '#9ca3af', display: 'block', marginTop: '8px' }}>
                      Selected: {imageFile.name}
                    </small>
                  )}
                </div>
              )}

              {imageSource === 'ai' && (
                <div className="form-group">
                  <div style={{
                    marginBottom: '12px',
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '12px',
                    fontSize: '13px',
                    color: '#93c5fd',
                  }}>
                    <strong>AI image: 0.1 USDC (x402)</strong> – Payment is required before generating.
                  </div>
                  {x402Error && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '12px 16px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      color: '#fca5a5',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      {x402Error}
                    </div>
                  )}
                  <label>AI prompt</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. A cute cat wearing a crown, digital art"
                    style={{
                      padding: '12px',
                      border: '2px solid #374151',
                      borderRadius: '12px',
                      fontSize: '14px',
                      minHeight: '80px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      color: '#e5e7eb',
                    }}
                    maxLength={300}
                  />
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={!aiPrompt.trim() || !isConnected || !isX402Connected || isGeneratingAi || isLoadingX402}
                    style={{
                      marginTop: '8px',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: '600',
                      cursor: isGeneratingAi || isLoadingX402 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoadingX402 ? 'Processing payment...' : isGeneratingAi ? 'Generating...' : 'Generate image (Pay 0.1 USDC)'}
                  </button>
                  {aiImageUrl && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', color: '#86efac' }}>
                      Image ready. Set name, symbol, supply and click Deploy.
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="deploy-form">
                <div className="form-group">
                  <label>Collection name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My NFT Collection"
                    required
                    maxLength={32}
                    style={{
                      padding: '12px 16px',
                      border: '2px solid #374151',
                      borderRadius: '12px',
                      fontSize: '16px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      color: '#e5e7eb',
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Symbol</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="MNFT"
                    required
                    maxLength={10}
                    style={{
                      padding: '12px 16px',
                      border: '2px solid #374151',
                      borderRadius: '12px',
                      fontSize: '16px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      color: '#e5e7eb',
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Supply (1–100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={supply}
                    onChange={(e) => setSupply(Number(e.target.value) || 1)}
                    style={{
                      padding: '12px 16px',
                      border: '2px solid #374151',
                      borderRadius: '12px',
                      fontSize: '16px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      color: '#e5e7eb',
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Description (optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description"
                    style={{
                      padding: '12px 16px',
                      border: '2px solid #374151',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      color: '#e5e7eb',
                    }}
                  />
                </div>

                {(createError || x402Error) && (
                  <div
                    ref={errorRef}
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: '12px',
                      marginBottom: '16px',
                      color: '#fca5a5',
                    }}
                  >
                    <AlertCircle size={20} style={{ flexShrink: 0 }} />
                    <span>{createError || x402Error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !canDeploy}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: canDeploy && !loading ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#374151',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: canDeploy && !loading ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loading ? 'Processing...' : `Deploy collection (0.002 ETH) + mint ${supply} NFT(s)`}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </NetworkGuard>
  )
}
