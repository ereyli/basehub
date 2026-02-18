import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import { Package, ExternalLink, AlertCircle, CheckCircle, ArrowLeft, Minus, Plus } from 'lucide-react'
import NetworkGuard from '../components/NetworkGuard'
import { useNFTMint } from '../hooks/useNFTMint'
import { supabase } from '../config/supabase'

function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function NFTMintPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()

  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [quantity, setQuantity] = useState(1)

  // Load collection from Supabase by slug
  useEffect(() => {
    if (!slug || !supabase?.from) {
      setLoading(false)
      setNotFound(true)
      return
    }
    let cancelled = false
    supabase
      .from('nft_launchpad_collections')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error || !data) {
          setNotFound(true)
        } else {
          setCollection(data)
        }
      })
    return () => { cancelled = true }
  }, [slug])

  const contractAddress = collection?.contract_address || null
  const {
    mint,
    isLoading: isMinting,
    error: mintError,
    txHash,
    success: mintSuccess,
    totalSupply,
    maxSupply,
    mintPrice,
    saleActive,
    isReadingChain,
    refreshState,
  } = useNFTMint(contractAddress)

  const handleMint = async () => {
    try {
      await mint(quantity)
    } catch (_) {
      // error in hook
    }
  }

  const totalCostWei = mintPrice * BigInt(quantity)
  const totalCostEth = formatEther(totalCostWei)
  const mintPriceEth = formatEther(mintPrice)
  const minted = Number(totalSupply)
  const max = Number(maxSupply)
  const pct = max > 0 ? Math.min(100, Math.round((minted / max) * 100)) : 0
  const isSoldOut = minted >= max

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#9ca3af' }}>
        Loading collection...
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#9ca3af', gap: '16px' }}>
        <Package size={48} style={{ opacity: 0.5 }} />
        <p>Collection not found.</p>
        <button onClick={() => navigate('/nft-launchpad')} style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>
          Back to Launchpad
        </button>
      </div>
    )
  }

  return (
    <NetworkGuard showWarning={true}>
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/nft-launchpad')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', fontSize: '14px' }}
        >
          <ArrowLeft size={16} /> Back to Launchpad
        </button>

        {/* Collection card */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(55, 65, 81, 0.8)',
          borderRadius: '20px', overflow: 'hidden',
        }}>
          {/* Image */}
          {collection.image_url ? (
            <img
              src={collection.image_url} alt={collection.name}
              style={{ width: '100%', height: '320px', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '320px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={64} style={{ color: '#60a5fa', opacity: 0.5 }} />
            </div>
          )}

          {/* Info */}
          <div style={{ padding: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#e5e7eb', marginBottom: '4px' }}>
              {collection.name}
            </h1>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
              {collection.symbol} · Created by {shortAddress(collection.deployer_address)}
            </p>
            {collection.description && (
              <p style={{ fontSize: '14px', color: '#d1d5db', marginBottom: '16px', lineHeight: 1.5 }}>
                {collection.description}
              </p>
            )}

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Price</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#e5e7eb' }}>{isReadingChain ? '...' : mintPriceEth} ETH</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Minted</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#e5e7eb' }}>{isReadingChain ? '...' : `${minted}/${max}`}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Status</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: isSoldOut ? '#f87171' : saleActive ? '#22c55e' : '#f59e0b' }}>
                  {isReadingChain ? '...' : isSoldOut ? 'Sold Out' : saleActive ? 'Live' : 'Paused'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                <span>Progress</span>
                <span>{pct}%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(55, 65, 81, 0.8)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: isSoldOut ? '#f87171' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                  borderRadius: '4px', transition: 'width 0.5s',
                }} />
              </div>
            </div>

            {/* Mint success */}
            {mintSuccess && txHash && (
              <div style={{
                padding: '16px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '12px', marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CheckCircle size={20} style={{ color: '#22c55e' }} />
                  <span style={{ fontWeight: '600', color: '#22c55e' }}>Mint successful!</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    View transaction <ExternalLink size={12} />
                  </a>
                  <a
                    href={`https://opensea.io/assets/base/${contractAddress}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    View on OpenSea <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            {/* Mint error */}
            {mintError && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px',
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '12px', marginBottom: '16px', color: '#fca5a5', fontSize: '14px',
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{mintError}</span>
              </div>
            )}

            {/* Quantity selector + Mint button */}
            {!isSoldOut && saleActive && !isReadingChain && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || isMinting}
                    style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      border: '1px solid #374151', background: 'rgba(30, 41, 59, 0.8)',
                      color: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: quantity <= 1 || isMinting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Minus size={16} />
                  </button>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: '#e5e7eb', minWidth: '40px', textAlign: 'center' }}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(20, quantity + 1))}
                    disabled={quantity >= 20 || isMinting}
                    style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      border: '1px solid #374151', background: 'rgba(30, 41, 59, 0.8)',
                      color: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: quantity >= 20 || isMinting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  onClick={handleMint}
                  disabled={!isConnected || isMinting}
                  style={{
                    width: '100%', padding: '16px',
                    background: isConnected && !isMinting ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#374151',
                    color: '#fff', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: '700',
                    cursor: isConnected && !isMinting ? 'pointer' : 'not-allowed',
                  }}
                >
                  {!isConnected
                    ? 'Connect Wallet to Mint'
                    : isMinting
                      ? 'Confirm in wallet...'
                      : `Mint ${quantity} NFT${quantity > 1 ? 's' : ''} for ${totalCostEth} ETH`}
                </button>
              </div>
            )}

            {/* Sold out / Paused state */}
            {!isReadingChain && isSoldOut && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#f87171', fontSize: '16px', fontWeight: '600' }}>
                Sold Out
              </div>
            )}
            {!isReadingChain && !saleActive && !isSoldOut && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#f59e0b', fontSize: '16px', fontWeight: '600' }}>
                Sale is currently paused
              </div>
            )}

            {/* External links */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
              <a
                href={`https://opensea.io/assets/base/${contractAddress}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                OpenSea <ExternalLink size={12} />
              </a>
              <a
                href={`https://basescan.org/address/${contractAddress}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Basescan <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </NetworkGuard>
  )
}
