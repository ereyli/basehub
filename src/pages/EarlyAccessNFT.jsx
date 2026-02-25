import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useEarlyAccessMint } from '../hooks/useEarlyAccessMint'
import { Helmet } from 'react-helmet-async'
import BackButton from '../components/BackButton'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { getFarcasterUniversalLink } from '../config/farcaster'
import { Zap, Users, Package, CheckCircle, ExternalLink, Sparkles, Share2, AlertCircle, Gift, Percent, Rocket } from 'lucide-react'
import { NETWORKS, getTransactionExplorerUrl } from '../config/networks'

const EarlyAccessNFT = () => {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const {
    mint,
    isLoading,
    error,
    totalMinted,
    uniqueMinters,
    maxSupply,
    mintPrice,
    mintingEnabled,
    userHasMinted,
    userMintCount,
    isSuccess,
    hash
  } = useEarlyAccessMint()
  
  // Early Access NFT only works on Base network
  const isOnBase = chainId === NETWORKS.BASE.chainId

  const [mintResult, setMintResult] = useState(null)
  const [isSharing, setIsSharing] = useState(false)
  const [isSharingGeneral, setIsSharingGeneral] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  
  // Check if in Farcaster environment
  let isInFarcaster = false
  let farcasterContext = null
  try {
    if (!shouldUseRainbowKit()) {
      farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    }
  } catch (error) {
    isInFarcaster = false
  }
  
  // Function to share cast (used by both buttons)
  const handleShareCast = async (isAfterMint = false) => {
    if (!farcasterContext?.sdk?.actions?.composeCast) {
      console.warn('Farcaster SDK not available')
      return
    }
    
    if (isAfterMint) {
      setIsSharing(true)
    } else {
      setIsSharingGeneral(true)
    }
    
    try {
      const remainingSupply = maxSupply - totalMinted
      let castText = ''
      
      const earlyAccessUrl = getFarcasterUniversalLink('/early-access')
      const appLinks = `\n\n🌐 Web: https://basehub.fun/early-access\n🎭 Farcaster: ${earlyAccessUrl}`
      if (isAfterMint) {
        castText = `🎉 Just minted my BaseHub Early Access Pass! 🚀\n\n✨ Unlock exclusive benefits:\n• Dynamic XP multiplier: (NFT Count + 1)x on ALL activities\n• 1 NFT = 2x, 2 NFTs = 3x, 10 NFTs = 11x!\n• Priority access to airdrops\n• Exclusive quests & rewards\n• Early feature access\n\n🔥 Only ${remainingSupply} passes left!\n\nJoin the BaseHub community and level up faster! 💎\n\n#BaseHub #BaseNetwork #NFT #EarlyAccess${appLinks}`
      } else {
        castText = `🚀 BaseHub Early Access Pass is LIVE! 🎉\n\n✨ Exclusive benefits for holders:\n• Dynamic XP multiplier: (NFT Count + 1)x on ALL activities\n• 1 NFT = 2x, 2 NFTs = 3x, 10 NFTs = 11x!\n• Priority access to airdrops\n• Exclusive quests & rewards\n• Early feature access\n\n🔥 Only ${remainingSupply} of ${maxSupply} passes remaining!\n\nMint yours now and join the BaseHub community! 💎\n\n#BaseHub #BaseNetwork #NFT #EarlyAccess${appLinks}`
      }
      
      await farcasterContext.sdk.actions.composeCast({
        text: castText,
        embeds: [earlyAccessUrl]
      })
      
      console.log('✅ Cast shared successfully!')
    } catch (error) {
      console.error('❌ Failed to share cast:', error)
    } finally {
      if (isAfterMint) {
        setIsSharing(false)
      } else {
        setIsSharingGeneral(false)
      }
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatPrice = (price) => {
    if (typeof price === 'bigint') {
      const ethValue = Number(price) / 1e18
      return ethValue.toFixed(6)
    }
    if (typeof price === 'number') {
      return price.toFixed(6)
    }
    return '0.001000'
  }

  const handleMint = async () => {
    // If not on Base network, switch to Base first
    if (!isOnBase) {
      try {
        await switchChain({ chainId: NETWORKS.BASE.chainId })
        // Wait a bit for the network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        // After switching, the user can click mint again
        return
      } catch (err) {
        console.error('Failed to switch to Base network:', err)
        alert('Please switch to Base network to mint your NFT')
        return
      }
    }
    
    try {
      setMintResult(null)
      await mint()
    } catch (err) {
      console.error('Mint failed:', err)
    }
  }

  useEffect(() => {
    if (isSuccess && hash) {
      setMintResult({
        success: true,
        hash
      })
    }
  }, [isSuccess, hash])

  const remainingSupply = maxSupply - totalMinted
  const progressPercentage = maxSupply > 0 ? (totalMinted / maxSupply) * 100 : 0

  const sectionPad = isMobile ? 16 : 24
  const titleSize = isMobile ? '1.75rem' : '2.25rem'
  const cardPad = isMobile ? '20px' : '32px'

  return (
    <div className="early-access-nft-page" style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0c1222 0%, #1a2744 40%, #0f172a 100%)',
      padding: isMobile ? '12px' : '24px',
      color: '#fff',
      boxSizing: 'border-box'
    }}>
      <Helmet>
        <title>Early Access NFT - BaseHub</title>
        <meta name="description" content="Mint your BaseHub Early Access Pass NFT – 2x XP, Wheel game, Launchpad discount & more" />
      </Helmet>

      <div style={{
        maxWidth: '920px',
        margin: '0 auto',
        padding: isMobile ? '0' : '8px'
      }}>
        <BackButton />

        {/* Hero */}
        <div style={{
          textAlign: 'center',
          marginBottom: isMobile ? 24 : 32,
          marginTop: isMobile ? 12 : 20
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: isMobile ? 10 : 14,
            marginBottom: isMobile ? 12 : 16,
            flexWrap: 'wrap'
          }}>
            <Sparkles size={isMobile ? 32 : 40} style={{ color: '#60a5fa', flexShrink: 0 }} />
            <h1 style={{
              fontSize: titleSize,
              fontWeight: '800',
              margin: 0,
              background: 'linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px',
              lineHeight: 1.2
            }}>
              BaseHub Early Access Pass
            </h1>
          </div>
          <p style={{
            fontSize: isMobile ? '0.95rem' : '1.1rem',
            color: '#94a3b8',
            marginTop: 6,
            fontWeight: 400
          }}>
            Join the community and unlock exclusive benefits
          </p>
        </div>

        {/* Stats – compact grid, mobile friendly */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: isMobile ? 10 : 16,
          marginBottom: isMobile ? 20 : 28
        }}>
          {[
            { icon: Package, value: `${totalMinted} / ${maxSupply}`, label: 'Total Minted' },
            { icon: Users, value: String(uniqueMinters), label: 'Unique Minters' },
            { icon: Zap, value: String(remainingSupply), label: 'Remaining' }
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              style={{
                background: 'rgba(30, 58, 138, 0.25)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 14,
                padding: isMobile ? 14 : 20,
                textAlign: 'center',
                backdropFilter: 'blur(8px)'
              }}
            >
              <Icon size={isMobile ? 22 : 26} style={{ marginBottom: 6, color: '#60a5fa' }} />
              <div style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: '700', color: '#fff', marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: '#94a3b8', fontWeight: '500' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{
          background: 'rgba(30, 58, 138, 0.2)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 14,
          padding: isMobile ? 16 : 24,
          marginBottom: isMobile ? 24 : 32,
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: isMobile ? '0.9rem' : '1rem', color: '#cbd5e1', fontWeight: '600' }}>Minting Progress</span>
            <span style={{ fontSize: isMobile ? '0.95rem' : '1.05rem', color: '#60a5fa', fontWeight: '700' }}>{progressPercentage.toFixed(2)}%</span>
          </div>
          <div style={{
            width: '100%',
            height: isMobile ? 12 : 14,
            background: 'rgba(15, 23, 42, 0.7)',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{
              width: `${progressPercentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              transition: 'width 0.5s ease',
              borderRadius: 8,
              boxShadow: '0 0 16px rgba(59, 130, 246, 0.4)'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#94a3b8' }}>
            <span>{totalMinted} minted</span>
            <span>{remainingSupply} remaining</span>
          </div>
        </div>

        {/* NFT image + Mint card side-by-side on desktop, stacked on mobile */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '260px 1fr',
          gap: isMobile ? 20 : 28,
          alignItems: 'start',
          marginBottom: isMobile ? 28 : 36
        }}>
          {/* NFT preview */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: isMobile ? 220 : 260
          }}>
            <div style={{
              width: isMobile ? '200px' : '240px',
              height: isMobile ? '200px' : '240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.06) 100%)',
              borderRadius: 20,
              border: '2px solid rgba(59, 130, 246, 0.3)',
              boxShadow: '0 16px 48px rgba(59, 130, 246, 0.25)',
              animation: 'floatRotate 6s ease-in-out infinite'
            }}>
              <img
                src="/BaseHubNFT.png"
                alt="BaseHub Early Access Pass"
                style={{
                  maxWidth: '92%',
                  maxHeight: '92%',
                  objectFit: 'contain',
                  borderRadius: 12
                }}
              />
            </div>
          </div>

          {/* Mint card – prominent CTA */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.18) 0%, rgba(37, 99, 235, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: 20,
            padding: cardPad,
            textAlign: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{
              fontSize: isMobile ? '1.35rem' : '1.6rem',
              fontWeight: '700',
              marginBottom: isMobile ? 12 : 16,
              color: '#fff'
            }}>
              Mint Your Early Access Pass
            </h2>
            <div style={{
              fontSize: isMobile ? '2rem' : '2.25rem',
              fontWeight: '800',
              color: '#60a5fa',
              marginBottom: isMobile ? 20 : 28,
              fontFamily: 'monospace',
              letterSpacing: '0.5px'
            }}>
              {formatPrice(mintPrice)} ETH
            </div>


          {/* Show network warning if not on Base */}
          {!isOnBase && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              color: '#fca5a5',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={20} />
              <span>Early Access NFT minting requires Base network. Click "Mint" to switch to Base automatically.</span>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              color: '#fca5a5',
              fontSize: '0.95rem'
            }}>
              {error}
            </div>
          )}

          {mintingEnabled === false && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              color: '#fca5a5',
              fontSize: '0.95rem'
            }}>
              Minting is currently disabled
            </div>
          )}

          {totalMinted >= maxSupply && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              color: '#6ee7b7',
              fontSize: '0.95rem'
            }}>
              All passes have been minted!
            </div>
          )}

          <button
            onClick={handleMint}
            disabled={!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply}
            style={{
              width: '100%',
              minHeight: isMobile ? 52 : 56,
              padding: isMobile ? '16px 24px' : '18px 32px',
              fontSize: isMobile ? '1.05rem' : '1.15rem',
              fontWeight: '700',
              background: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply)
                ? 'rgba(100, 100, 100, 0.2)'
                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '14px',
              cursor: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply)
                ? 'not-allowed'
                : 'pointer',
              transition: 'all 0.3s ease',
              marginBottom: '24px',
              boxShadow: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply)
                ? 'none'
                : '0 8px 24px rgba(59, 130, 246, 0.4)',
              transform: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply)
                ? 'none'
                : 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.5)'
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4)'
              }
            }}
          >
            {!isConnected
              ? 'Connect Wallet'
              : isLoading
              ? 'Minting...'
              : totalMinted >= maxSupply
              ? 'Sold Out'
              : mintingEnabled === false
              ? 'Minting Disabled'
              : !isOnBase
              ? 'Switch to Base & Mint'
              : 'Mint Early Access Pass'}
          </button>

          {isLoading && (
            <div style={{
              color: '#94a3b8',
              fontSize: '0.9rem',
              marginTop: '12px'
            }}>
              Please confirm the transaction in your wallet...
            </div>
          )}

          {/* Share on Farcaster Button (Always visible) */}
          {isInFarcaster && farcasterContext && (
            <button
              onClick={() => handleShareCast(false)}
              disabled={isSharingGeneral}
              style={{
                width: '100%',
                padding: '14px 24px',
                fontSize: '1rem',
                fontWeight: '600',
                background: isSharingGeneral 
                  ? 'rgba(139, 92, 246, 0.3)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: isSharingGeneral ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '12px',
                boxShadow: isSharingGeneral ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!isSharingGeneral) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSharingGeneral) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'
                }
              }}
            >
              <Share2 size={18} />
              {isSharingGeneral ? 'Sharing...' : 'Share on Farcaster 🎉'}
            </button>
          )}

          {mintResult?.success && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '14px',
              padding: '24px',
              marginTop: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                color: '#34d399',
                fontSize: '1.15rem',
                fontWeight: '700'
              }}>
                <CheckCircle size={26} />
                Mint Successful!
              </div>
              {hash && (
                <a
                  href={getTransactionExplorerUrl(chainId, hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#60a5fa',
                    textDecoration: 'none',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    transition: 'color 0.2s ease',
                    marginBottom: '16px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#93c5fd'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#60a5fa'}
                >
                  View Transaction <ExternalLink size={16} />
                </a>
              )}
              
              {/* Share on Farcaster Button (After mint) */}
              {isInFarcaster && farcasterContext && (
                <button
                  onClick={() => handleShareCast(true)}
                  disabled={isSharing}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    background: isSharing 
                      ? 'rgba(59, 130, 246, 0.3)'
                      : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: isSharing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '12px',
                    boxShadow: isSharing ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSharing) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSharing) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'
                    }
                  }}
                >
                  <Share2 size={18} />
                  {isSharing ? 'Sharing...' : 'Share on Farcaster 🎉'}
                </button>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Benefits Section – with page links */}
        <div style={{
          background: 'rgba(30, 58, 138, 0.2)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 20,
          padding: isMobile ? 20 : 32,
          marginTop: isMobile ? 28 : 40,
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            fontWeight: '700',
            marginBottom: isMobile ? 18 : 24,
            textAlign: 'center',
            color: '#fff'
          }}>
            Early Access Benefits
          </h3>

          {/* Benefit list with links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
            <Link
              to="/nft-wheel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? 14 : 18,
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                borderRadius: 12,
                color: '#e9d5ff',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: isMobile ? '0.95rem' : '1rem',
                transition: 'background 0.2s, border-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)'
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.35)'
              }}
            >
              <Gift size={22} style={{ flexShrink: 0, color: '#a78bfa' }} />
              <span>Access the Wheel game and earn XP</span>
              <ExternalLink size={16} style={{ marginLeft: 'auto', opacity: 0.8 }} />
            </Link>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? 14 : 18,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
              color: '#cbd5e1',
              fontSize: isMobile ? '0.95rem' : '1rem',
              fontWeight: '500'
            }}>
              <Zap size={22} style={{ flexShrink: 0, color: '#60a5fa' }} />
              <span>Minimum <strong style={{ color: '#93c5fd' }}>2x XP bonus</strong> – (NFT count + 1)x on every activity</span>
            </div>

            <Link
              to="/nft-launchpad"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? 14 : 18,
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                borderRadius: 12,
                color: '#bbf7d0',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: isMobile ? '0.95rem' : '1rem',
                transition: 'background 0.2s, border-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.22)'
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.12)'
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.35)'
              }}
            >
              <Percent size={22} style={{ flexShrink: 0, color: '#4ade80' }} />
              <span><strong>75% discount</strong> on NFT Launchpad – normally ~$4, holders can create a collection for ~$1</span>
              <ExternalLink size={16} style={{ marginLeft: 'auto', opacity: 0.8 }} />
            </Link>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: isMobile ? 10 : 14
            }}>
              {[
                { icon: Rocket, text: 'Early Feature Access' },
                { icon: CheckCircle, text: 'Priority Airdrops' },
                { icon: CheckCircle, text: 'Exclusive Quests' }
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: isMobile ? 12 : 14,
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: 10,
                    color: '#cbd5e1',
                    fontSize: isMobile ? '0.9rem' : '0.95rem',
                    fontWeight: '500'
                  }}
                >
                  <Icon size={18} style={{ flexShrink: 0, color: '#60a5fa' }} />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* XP multiplier grid – compact on mobile */}
          <div style={{
            marginTop: isMobile ? 20 : 28,
            paddingTop: isMobile ? 18 : 24,
            borderTop: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <h4 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: '700', color: '#93c5fd', marginBottom: 12 }}>
              Dynamic XP multiplier (NFT count + 1)x
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: 8
            }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <div key={n} style={{
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: 8,
                  padding: 10,
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#a78bfa', fontWeight: '700', fontSize: isMobile ? '0.85rem' : '0.9rem' }}>{n} NFT</div>
                  <div style={{ color: '#c4b5fd', fontSize: isMobile ? '0.75rem' : '0.8rem' }}>{(n + 1)}x</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          
          @keyframes floatRotate {
            0%, 100% {
              transform: translate(0, 0) rotateY(0deg) rotateX(0deg);
            }
            25% {
              transform: translate(8px, -12px) rotateY(4deg) rotateX(2deg);
            }
            50% {
              transform: translate(-6px, -8px) rotateY(0deg) rotateX(0deg);
            }
            75% {
              transform: translate(-8px, -14px) rotateY(-4deg) rotateX(-2deg);
            }
          }
        `}</style>
      </div>
    </div>
  )
}

export default EarlyAccessNFT
