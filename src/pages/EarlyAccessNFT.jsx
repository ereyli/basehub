import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useEarlyAccessMint } from '../hooks/useEarlyAccessMint'
import { Helmet } from 'react-helmet-async'
import BackButton from '../components/BackButton'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { Zap, Users, Package, CheckCircle, ExternalLink, Sparkles, Share2, AlertCircle } from 'lucide-react'
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
      
      if (isAfterMint) {
        castText = `🎉 Just minted my BaseHub Early Access Pass! 🚀\n\n✨ Unlock exclusive benefits:\n• Dynamic XP multiplier: (NFT Count + 1)x on ALL activities\n• 1 NFT = 2x, 2 NFTs = 3x, 10 NFTs = 11x!\n• Priority access to airdrops\n• Exclusive quests & rewards\n• Early feature access\n\n🔥 Only ${remainingSupply} passes left!\n\nJoin the BaseHub community and level up faster! 💎\n\n#BaseHub #BaseNetwork #NFT #EarlyAccess`
      } else {
        castText = `🚀 BaseHub Early Access Pass is LIVE! 🎉\n\n✨ Exclusive benefits for holders:\n• Dynamic XP multiplier: (NFT Count + 1)x on ALL activities\n• 1 NFT = 2x, 2 NFTs = 3x, 10 NFTs = 11x!\n• Priority access to airdrops\n• Exclusive quests & rewards\n• Early feature access\n\n🔥 Only ${remainingSupply} of ${maxSupply} passes remaining!\n\nMint yours now and join the BaseHub community! 💎\n\n#BaseHub #BaseNetwork #NFT #EarlyAccess`
      }
      
      await farcasterContext.sdk.actions.composeCast({
        text: castText,
        embeds: ['https://basehub.fun/early-access']
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

  return (
    <div className="early-access-nft-page" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1929 0%, #1a2744 50%, #0f172a 100%)',
      padding: '20px',
      color: '#fff'
    }}>
      <Helmet>
        <title>Early Access NFT - BaseHub</title>
        <meta name="description" content="Mint your BaseHub Early Access Pass NFT" />
      </Helmet>

      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '20px'
      }}>
        <BackButton />
        
        <div style={{
          textAlign: 'center',
          marginBottom: '50px',
          marginTop: '30px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <Sparkles size={40} style={{ color: '#3b82f6' }} />
            <h1 style={{
              fontSize: '2.8rem',
              fontWeight: '700',
              margin: 0,
              background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px'
            }}>
              BaseHub Early Access Pass
            </h1>
          </div>
          <p style={{
            fontSize: '1.15rem',
            color: '#cbd5e1',
            marginTop: '10px',
            fontWeight: '300'
          }}>
            Join the BaseHub community and unlock exclusive benefits
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '24px',
          marginBottom: '40px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            transition: 'transform 0.2s ease',
            cursor: 'default'
          }}>
            <Package size={28} style={{ marginBottom: '12px', color: '#60a5fa' }} />
            <div style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>
              {totalMinted} / {maxSupply}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: '500' }}>Total Minted</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <Users size={28} style={{ marginBottom: '12px', color: '#60a5fa' }} />
            <div style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>
              {uniqueMinters}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: '500' }}>Unique Minters</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <Zap size={28} style={{ marginBottom: '12px', color: '#60a5fa' }} />
            <div style={{ fontSize: '2.2rem', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>
              {remainingSupply}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: '500' }}>Remaining</div>
          </div>
        </div>

        {/* Mint Progress Bar */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '40px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: '600' }}>Minting Progress</span>
            <span style={{ fontSize: '1.1rem', color: '#60a5fa', fontWeight: '700' }}>
              {progressPercentage.toFixed(2)}%
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '16px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{
              width: `${progressPercentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #93c5fd 100%)',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              borderRadius: '10px',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 2s infinite'
              }} />
            </div>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '12px',
            fontSize: '0.85rem',
            color: '#94a3b8'
          }}>
            <span>{totalMinted} minted</span>
            <span>{remainingSupply} remaining</span>
          </div>
        </div>

        {/* NFT Preview */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '40px'
        }}>
          <div style={{
            position: 'relative',
            width: '280px',
            height: '280px',
            perspective: '1000px'
          }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                animation: 'floatRotate 6s ease-in-out infinite',
                transformStyle: 'preserve-3d'
              }}
            >
              <img
                src="/BaseHubNFT.png"
                alt="BaseHub Early Access Pass NFT"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '20px',
                  boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Mint Section */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '20px',
          padding: '40px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            marginBottom: '24px',
            color: '#fff',
            letterSpacing: '-0.3px'
          }}>
            Mint Your Early Access Pass
          </h2>

          <div style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#60a5fa',
            marginBottom: '40px',
            fontFamily: 'monospace',
            letterSpacing: '1px'
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
              padding: '18px 32px',
              fontSize: '1.15rem',
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

        {/* Benefits Section */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          padding: '32px',
          marginTop: '40px',
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            marginBottom: '24px',
            textAlign: 'center',
            color: '#fff',
            letterSpacing: '-0.3px'
          }}>
            Early Access Benefits
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {/* Dynamic XP Multiplier Section */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <Zap size={24} color="#a78bfa" />
                <h4 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#fff',
                  margin: 0
                }}>
                  Dynamic XP Multiplier System
                </h4>
              </div>
              <p style={{
                color: '#cbd5e1',
                fontSize: '1rem',
                lineHeight: '1.6',
                marginBottom: '20px'
              }}>
                The more NFTs you hold, the higher your XP multiplier! Your multiplier is calculated as <strong style={{ color: '#a78bfa' }}>(NFT Count + 1)</strong>, meaning:
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                marginBottom: '20px'
              }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((nftCount) => (
                  <div key={nftCount} style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '10px',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#a78bfa', fontSize: '1.3rem', fontWeight: '700', marginBottom: '4px' }}>
                      {nftCount} {nftCount === 1 ? 'NFT' : 'NFTs'}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                      {(nftCount + 1)}x Multiplier
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                color: '#93c5fd',
                fontSize: '0.9rem',
                fontStyle: 'italic'
              }}>
                💡 <strong>Pro Tip:</strong> Hold multiple NFTs to maximize your XP earnings! Every NFT you own increases your multiplier by 1x.
              </div>
            </div>

            {/* Other Benefits */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px'
            }}>
              <div style={{ 
                color: '#cbd5e1', 
                fontSize: '1rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle size={20} color="#60a5fa" />
                Early Feature Access
              </div>
              <div style={{ 
                color: '#cbd5e1', 
                fontSize: '1rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle size={20} color="#60a5fa" />
                Priority Airdrops
              </div>
              <div style={{ 
                color: '#cbd5e1', 
                fontSize: '1rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle size={20} color="#60a5fa" />
                Exclusive Quests
              </div>
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
              transform: translateY(0px) rotateY(0deg) rotateX(0deg);
            }
            25% {
              transform: translateY(-15px) rotateY(5deg) rotateX(2deg);
            }
            50% {
              transform: translateY(-10px) rotateY(0deg) rotateX(0deg);
            }
            75% {
              transform: translateY(-15px) rotateY(-5deg) rotateX(-2deg);
            }
          }
        `}</style>
      </div>
    </div>
  )
}

export default EarlyAccessNFT
