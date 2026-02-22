import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { formatEther } from 'viem'
import { Package, ExternalLink, AlertCircle, CheckCircle, ArrowLeft, Minus, Plus, Copy, Zap, Users, Share2 } from 'lucide-react'
import NetworkGuard from '../components/NetworkGuard'
import { useNFTMint } from '../hooks/useNFTMint'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { getFarcasterUniversalLink } from '../config/farcaster'
import { supabase } from '../config/supabase'
import { getAddressExplorerUrl, getCollectionMarketUrl, getTransactionExplorerUrl, NETWORKS } from '../config/networks'
import { NFT_LAUNCH_COLLECTION_ABI } from '../config/nftCollection'

const SHARE_BASE_URL = 'https://www.basehub.fun'
function getMintUrl(slug) { return slug ? `${SHARE_BASE_URL}/mint/${slug}` : '' }

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

export default function NFTMintPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const chainId = useChainId()
  const { address, isConnected } = useAccount()

  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [copied, setCopied] = useState(false)
  const [holders, setHolders] = useState([])
  const [holdersLoading, setHoldersLoading] = useState(false)
  const [holderFetchKey, setHolderFetchKey] = useState(0)
  const [isSharingCast, setIsSharingCast] = useState(false)
  const publicClient = usePublicClient()

  const farcaster = useFarcaster()
  const isWeb = shouldUseRainbowKit()
  const isInFarcaster = farcaster?.isInFarcaster ?? false
  const castSdk = farcaster?.sdk ?? null

  const handleTweetCollection = () => {
    if (!collection?.slug) return
    const mintUrl = getMintUrl(collection.slug)
    const marketUrl = getCollectionMarketUrl(collection.contract_address, collection.chain_id ?? chainId)
    const name = collection.name || 'NFT Collection'
    const text = `🎨 "${name}" on Base – mint now!\n\nMint: ${mintUrl}\nOpenSea: ${marketUrl}\n\n#BaseHub #NFT #Base`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleCastCollection = async () => {
    if (!castSdk?.actions?.composeCast || !collection?.slug) return
    const mintUrlFarcaster = getFarcasterUniversalLink(`/mint/${collection.slug}`)
    const marketUrl = getCollectionMarketUrl(collection.contract_address, collection.chain_id ?? chainId)
    const name = collection.name || 'NFT Collection'
    const castText = `🎨 "${name}" on BaseHub – mint on Base!\n\nMint: ${mintUrlFarcaster}\nOpenSea: ${marketUrl}\n\n#BaseHub #NFT #Base\n\n🌐 Web: ${SHARE_BASE_URL}/nft-launchpad\n🎭 Farcaster: ${getFarcasterUniversalLink('/nft-launchpad')}`
    setIsSharingCast(true)
    try {
      await castSdk.actions.composeCast({ text: castText, embeds: [mintUrlFarcaster] })
    } catch (err) {
      console.error('NFT Mint cast failed:', err)
    } finally {
      setIsSharingCast(false)
    }
  }

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

  // Fetch minters from last ~50k blocks only (avoids scanning millions of blocks; ~1–2 days on Base)
  const HOLDER_BLOCK_RANGE = 50000n
  const HOLDER_CHUNK = 2000n
  useEffect(() => {
    if (!contractAddress || !publicClient) return
    let cancelled = false
    setHoldersLoading(true)
    publicClient
      .getBlockNumber()
      .then(async (toBlock) => {
        if (cancelled) return
        const fromBlock = toBlock > HOLDER_BLOCK_RANGE ? toBlock - HOLDER_BLOCK_RANGE : 0n
        const allLogs = []
        let from = fromBlock
        while (from <= toBlock) {
          const chunkTo = from + HOLDER_CHUNK - 1n > toBlock ? toBlock : from + HOLDER_CHUNK - 1n
          try {
            const logs = await publicClient.getContractEvents({
              address: contractAddress,
              abi: NFT_LAUNCH_COLLECTION_ABI,
              eventName: 'Minted',
              fromBlock: from,
              toBlock: chunkTo,
            })
            allLogs.push(...logs)
          } catch (_) {
            // skip chunk on error
          }
          from = chunkTo + 1n
          if (cancelled) return
        }
        if (cancelled) return
        const byAddress = {}
        for (const e of allLogs) {
          const minter = e.args?.minter
          if (minter) {
            byAddress[minter] = (byAddress[minter] || 0) + Number(e.args.quantity ?? 1)
          }
        }
        const list = Object.entries(byAddress)
          .map(([address, count]) => ({ address, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50)
        setHolders(list)
      })
      .catch(() => { if (!cancelled) setHolders([]) })
      .finally(() => { if (!cancelled) setHoldersLoading(false) })
    return () => { cancelled = true }
  }, [contractAddress, publicClient, holderFetchKey])

  // After successful mint, refetch holders once so new minter appears (short delay for chain to index)
  useEffect(() => {
    if (mintSuccess) {
      const t = setTimeout(() => setHolderFetchKey((k) => k + 1), 2000)
      return () => clearTimeout(t)
    }
  }, [mintSuccess])

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
        <button onClick={() => navigate('/nft-launchpad?tab=explore')} style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>
          Back to Collection
        </button>
      </div>
    )
  }

  const copyContract = () => {
    if (!contractAddress) return
    navigator.clipboard.writeText(contractAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const cardStyle = {
    background: 'rgba(30, 41, 59, 0.9)',
    border: '1px solid rgba(55, 65, 81, 0.8)',
    borderRadius: '20px',
    overflow: 'hidden',
  }

  return (
    <NetworkGuard showWarning={true}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        <button
          onClick={() => navigate('/nft-launchpad?tab=explore')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', fontSize: '14px' }}
        >
          <ArrowLeft size={16} /> Back to Collection
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          {/* Left: Image + Mint card */}
          <div style={{ flex: '1 1 400px', minWidth: 0 }}>
            <div style={cardStyle}>
              {collection.image_url ? (
                <div style={{
                  width: '100%',
                  height: '320px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px',
                  boxSizing: 'border-box',
                }}>
                  <img
                    src={collection.image_url}
                    alt={collection.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              ) : (
                <div style={{ width: '100%', height: '320px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={64} style={{ color: '#60a5fa', opacity: 0.5 }} />
                </div>
              )}
              <div style={{ padding: '24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#e5e7eb', marginBottom: '6px' }}>
                  {collection.name}
                </h1>
                <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
                  {collection.symbol} · Created by{' '}
                  <a
                    href={getAddressExplorerUrl(collection?.chain_id ?? chainId, collection.deployer_address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#60a5fa', textDecoration: 'none' }}
                  >
                    {shortAddress(collection.deployer_address)}
                  </a>
                </p>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '80px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Price</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#e5e7eb' }}>{isReadingChain ? '...' : (mintPrice === 0n ? 'Free' : `${mintPriceEth} ETH`)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '80px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Minted so far</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#e5e7eb' }}>{isReadingChain ? '...' : `${minted}/${max}`}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '80px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Status</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: isSoldOut ? '#f87171' : saleActive ? '#22c55e' : '#f59e0b' }}>
                      {isReadingChain ? '...' : isSoldOut ? 'Sold Out' : saleActive ? 'Live' : 'Paused'}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                    <span>Progress</span>
                    <span>{minted} / {max} minted so far · {pct}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(55, 65, 81, 0.8)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: isSoldOut ? '#f87171' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                      borderRadius: '4px', transition: 'width 0.5s',
                    }} />
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: '16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#93c5fd',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    textAlign: 'center',
                  }}
                >
                  Wallet limit: 20 total
                </div>

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
                      <a href={getTransactionExplorerUrl(collection?.chain_id ?? chainId, txHash)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        View transaction <ExternalLink size={12} />
                      </a>
                      <a href={getCollectionMarketUrl(contractAddress, collection?.chain_id ?? chainId)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        View on OpenSea <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}

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
                      <span style={{ fontSize: '24px', fontWeight: '700', color: '#e5e7eb', minWidth: '40px', textAlign: 'center' }}>{quantity}</span>
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
                      {!isConnected ? 'Connect Wallet to Mint' : isMinting ? 'Confirm in wallet...' : totalCostWei === 0n ? `Mint ${quantity} NFT${quantity > 1 ? 's' : ''} — Free` : `Mint ${quantity} NFT${quantity > 1 ? 's' : ''} for ${totalCostEth} ETH`}
                    </button>
                  </div>
                )}

                {!isReadingChain && isSoldOut && (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#f87171', fontSize: '16px', fontWeight: '600' }}>Sold Out</div>
                )}
                {!isReadingChain && !saleActive && !isSoldOut && (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#f59e0b', fontSize: '16px', fontWeight: '600' }}>Sale is currently paused</div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
                  <a href={getCollectionMarketUrl(contractAddress, collection?.chain_id ?? chainId)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    OpenSea <ExternalLink size={12} />
                  </a>
                  <a href={getAddressExplorerUrl(collection?.chain_id ?? chainId, contractAddress)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {(collection?.chain_id ?? chainId) === NETWORKS.BASE.chainId ? 'Basescan' : (collection?.chain_id ?? chainId) === NETWORKS.INKCHAIN.chainId ? 'Ink Explorer' : 'Soneium Explorer'} <ExternalLink size={12} />
                  </a>
                </div>
                {/* Share: Tweet (web) / Cast (Farcaster) */}
                {slug && (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                    {isWeb && (
                      <button
                        type="button"
                        onClick={handleTweetCollection}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '600',
                          border: 'none', borderRadius: '10px', background: 'rgba(29, 155, 240, 0.2)', color: '#38bdf8', cursor: 'pointer',
                        }}
                      >
                        <Share2 size={16} /> Share on X
                      </button>
                    )}
                    {isInFarcaster && castSdk?.actions?.composeCast && (
                      <button
                        type="button"
                        onClick={handleCastCollection}
                        disabled={isSharingCast}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '600',
                          border: 'none', borderRadius: '10px',
                          background: isSharingCast ? 'rgba(55,65,81,0.5)' : 'rgba(0, 82, 255, 0.25)', color: isSharingCast ? '#64748b' : '#60a5fa', cursor: isSharingCast ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Share2 size={16} /> {isSharingCast ? 'Sharing...' : 'Share on Farcaster'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: About, Details, XP */}
          <div style={{ flex: '1 1 320px', minWidth: 0, maxWidth: '480px' }}>
            <div style={cardStyle}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Zap size={18} style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>Earn 200 XP per mint</span>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>About</h3>
                {collection.description ? (
                  <p style={{ fontSize: '14px', color: '#d1d5db', lineHeight: 1.6, marginBottom: '20px' }}>{collection.description}</p>
                ) : (
                  <p style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic', marginBottom: '20px' }}>No description provided.</p>
                )}

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Details</h3>
                <div style={{ fontSize: '13px', color: '#d1d5db', marginBottom: '12px' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Creator </span>
                    <a href={getAddressExplorerUrl(collection?.chain_id ?? chainId, collection.deployer_address)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>{shortAddress(collection.deployer_address)}</a>
                  </div>
                  {collection.created_at && (
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ color: '#64748b' }}>Launched </span>
                      <span>{timeAgo(collection.created_at)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#64748b' }}>Contract </span>
                    <code style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(15,23,42,0.6)', padding: '4px 8px', borderRadius: '6px' }}>{shortAddress(contractAddress)}</code>
                    <button
                      onClick={copyContract}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(55,65,81,0.8)',
                        background: 'rgba(30,41,59,0.8)', color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
                      }}
                    >
                      <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#9ca3af', marginBottom: '8px', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Links</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  <a href={getCollectionMarketUrl(contractAddress, collection?.chain_id ?? chainId)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ExternalLink size={14} /> OpenSea
                  </a>
                  <a href={getAddressExplorerUrl(collection?.chain_id ?? chainId, contractAddress)} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ExternalLink size={14} /> {(collection?.chain_id ?? chainId) === NETWORKS.BASE.chainId ? 'Basescan' : (collection?.chain_id ?? chainId) === NETWORKS.INKCHAIN.chainId ? 'Ink Explorer' : 'Soneium Explorer'}
                  </a>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} /> Holders
                </h3>
                {holdersLoading ? (
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Loading...</p>
                ) : holders.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>No mints yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {holders.map(({ address, count }) => (
                      <a
                        key={address}
                        href={getAddressExplorerUrl(collection?.chain_id ?? chainId, address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                      >
                        <span>{shortAddress(address)}</span>
                        {count > 1 && <span style={{ color: '#64748b', fontSize: '12px' }}>×{count}</span>}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </NetworkGuard>
  )
}
