import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useEarlyAccessMint } from '../hooks/useEarlyAccessMint'
import { Helmet } from 'react-helmet-async'
import BackButton from '../components/BackButton'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { getFarcasterUniversalLink } from '../config/farcaster'
import { Zap, Users, Package, CheckCircle, ExternalLink, Sparkles, Share2, AlertCircle, Gift, Percent, Rocket, Crown, Shield, Star } from 'lucide-react'
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
    if (!isOnBase) {
      try {
        await switchChain({ chainId: NETWORKS.BASE.chainId })
        await new Promise(resolve => setTimeout(resolve, 1000))
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

  const accent = '#3b82f6'
  const accentLight = '#60a5fa'
  const gold = '#f59e0b'
  const goldLight = '#fbbf24'

  const ShareBtn = ({ onClick, disabled, loading, label }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '13px 24px',
        fontSize: '14px',
        fontWeight: '600',
        background: disabled ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.12)',
        border: `1px solid ${disabled ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.3)'}`,
        color: disabled ? '#64748b' : accentLight,
        borderRadius: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '12px',
        fontFamily: 'Poppins, system-ui, sans-serif',
      }}
    >
      <Share2 size={16} />
      {loading ? 'Sharing...' : label}
    </button>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b1120',
      color: '#e2e8f0',
      fontFamily: 'Poppins, system-ui, -apple-system, sans-serif',
    }}>
      <Helmet>
        <title>Early Access NFT - BaseHub</title>
        <meta name="description" content="Mint your BaseHub Early Access Pass NFT – 2x XP, Wheel game, Launchpad discount & more" />
      </Helmet>

      {/* Subtle top glow */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: '880px',
        margin: '0 auto',
        padding: isMobile ? '14px 12px 80px' : '28px 24px 60px',
      }}>
        <BackButton />

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 40, marginTop: isMobile ? 8 : 16 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)',
            marginBottom: 16,
          }}>
            <Crown size={28} color={accentLight} />
          </div>
          <h1 style={{
            fontSize: isMobile ? '1.6rem' : '2.2rem',
            fontWeight: '800', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.15,
            color: '#f1f5f9',
          }}>
            Early Access Pass
          </h1>
          <p style={{ fontSize: isMobile ? '0.88rem' : '1rem', color: '#64748b', margin: 0, fontWeight: 400 }}>
            Exclusive membership for the BaseHub community
          </p>
        </div>

        {/* ── Stats row ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 24,
        }}>
          {[
            { value: `${totalMinted}`, sub: `/ ${maxSupply}`, label: 'Minted', color: accentLight },
            { value: String(uniqueMinters), sub: '', label: 'Holders', color: '#34d399' },
            { value: String(remainingSupply), sub: '', label: 'Remaining', color: goldLight },
          ].map(({ value, sub, label, color }) => (
            <div key={label} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: 14, padding: isMobile ? '14px 8px' : '18px 12px',
              textAlign: 'center', backdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: '800', color, lineHeight: 1 }}>
                {value}<span style={{ fontSize: '0.7em', color: '#64748b', fontWeight: 500 }}>{sub}</span>
              </div>
              <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: '#64748b', fontWeight: 500, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Progress ── */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: 14, padding: isMobile ? '14px 16px' : '18px 22px',
          marginBottom: isMobile ? 20 : 28,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Minting Progress</span>
            <span style={{ fontSize: '0.85rem', color: accentLight, fontWeight: 700, fontFamily: "'SF Mono', Menlo, monospace" }}>{progressPercentage.toFixed(1)}%</span>
          </div>
          <div style={{
            width: '100%', height: 8, background: 'rgba(30, 41, 59, 0.8)',
            borderRadius: 99, overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.max(progressPercentage, 0.5)}%`, height: '100%',
              background: `linear-gradient(90deg, ${accent}, ${accentLight})`,
              borderRadius: 99, transition: 'width 0.6s ease',
              boxShadow: `0 0 12px rgba(59, 130, 246, 0.35)`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.72rem', color: '#475569' }}>
            <span>{totalMinted} minted</span>
            <span>{remainingSupply} left</span>
          </div>
        </div>

        {/* ── NFT + Mint Card ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '240px 1fr',
          gap: isMobile ? 16 : 24,
          alignItems: 'stretch',
          marginBottom: isMobile ? 24 : 36,
        }}>
          {/* NFT Preview */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: 18, padding: isMobile ? 20 : 24,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'radial-gradient(circle at 50% 30%, rgba(59, 130, 246, 0.06) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: isMobile ? 180 : 200, height: isMobile ? 180 : 200,
              borderRadius: 16, overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              animation: 'nftFloat 5s ease-in-out infinite',
            }}>
              <img
                src="/BaseHubNFT.png"
                alt="BaseHub Early Access Pass"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          </div>

          {/* Mint Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: 18, padding: isMobile ? '24px 20px' : '32px 28px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 200, height: 200,
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <h2 style={{
              fontSize: isMobile ? '1.15rem' : '1.35rem', fontWeight: 700,
              color: '#f1f5f9', marginBottom: 6, marginTop: 0,
            }}>
              Mint Your Pass
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 0, marginBottom: isMobile ? 16 : 22 }}>
              One-time purchase, lifetime benefits
            </p>

            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              marginBottom: isMobile ? 20 : 26,
            }}>
              <span style={{
                fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 800, color: '#f1f5f9',
                fontFamily: "'SF Mono', Menlo, monospace", letterSpacing: '-1px', lineHeight: 1,
              }}>
                {formatPrice(mintPrice)}
              </span>
              <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>ETH</span>
            </div>

            {!isOnBase && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.06)', borderLeft: `3px solid ${gold}`,
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                color: goldLight, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>Switch to Base network required. Click mint to switch automatically.</span>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.06)', borderLeft: '3px solid #ef4444',
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                color: '#f87171', fontSize: '0.82rem',
              }}>
                {error}
              </div>
            )}

            {mintingEnabled === false && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.06)', borderLeft: '3px solid #ef4444',
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                color: '#f87171', fontSize: '0.82rem',
              }}>
                Minting is currently disabled
              </div>
            )}

            {totalMinted >= maxSupply && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)', borderLeft: '3px solid #34d399',
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                color: '#34d399', fontSize: '0.82rem',
              }}>
                All passes have been minted!
              </div>
            )}

            <button
              onClick={handleMint}
              disabled={!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply}
              style={{
                width: '100%', height: isMobile ? 50 : 54,
                fontSize: isMobile ? '0.95rem' : '1rem', fontWeight: 700,
                fontFamily: 'Poppins, system-ui, sans-serif',
                background: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply)
                  ? 'rgba(30, 41, 59, 0.6)'
                  : `linear-gradient(135deg, ${accent} 0%, #2563eb 100%)`,
                color: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply) ? '#475569' : '#fff',
                border: 'none', borderRadius: 12,
                cursor: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply) ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: (!isConnected || isLoading || mintingEnabled === false || totalMinted >= maxSupply)
                  ? 'none' : '0 6px 20px rgba(59, 130, 246, 0.3)',
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = '0 8px 28px rgba(59, 130, 246, 0.4)' }}
              onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.3)' }}
            >
              {!isConnected ? 'Connect Wallet'
                : isLoading ? 'Minting...'
                : totalMinted >= maxSupply ? 'Sold Out'
                : mintingEnabled === false ? 'Minting Disabled'
                : !isOnBase ? 'Switch to Base & Mint'
                : 'Mint Early Access Pass'}
            </button>

            {isLoading && (
              <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
                Confirm the transaction in your wallet...
              </p>
            )}

            {isInFarcaster && farcasterContext && (
              <ShareBtn onClick={() => handleShareCast(false)} disabled={isSharingGeneral} loading={isSharingGeneral} label="Share on Farcaster" />
            )}

            {mintResult?.success && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)', borderLeft: '3px solid #34d399',
                borderRadius: 12, padding: '18px 16px', marginTop: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#34d399', fontSize: '0.95rem', fontWeight: 700 }}>
                  <CheckCircle size={20} />
                  Mint Successful!
                </div>
                {hash && (
                  <a
                    href={getTransactionExplorerUrl(chainId, hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: accentLight, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    View Transaction <ExternalLink size={14} />
                  </a>
                )}
                {isInFarcaster && farcasterContext && (
                  <ShareBtn onClick={() => handleShareCast(true)} disabled={isSharing} loading={isSharing} label="Share on Farcaster" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Benefits ── */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: 20, padding: isMobile ? '22px 18px' : '32px 28px',
          marginBottom: isMobile ? 20 : 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 18 : 24 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.08)', border: `1px solid rgba(245, 158, 11, 0.15)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Shield size={20} color={goldLight} />
            </div>
            <div>
              <h3 style={{ fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                Holder Benefits
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Exclusive perks for pass holders</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
            {/* Wheel game */}
            <Link to="/nft-wheel" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: isMobile ? '13px 14px' : '16px 18px',
              background: 'rgba(59, 130, 246, 0.04)', borderLeft: `3px solid ${accentLight}`,
              borderRadius: 12, color: '#cbd5e1', textDecoration: 'none',
              fontSize: isMobile ? '0.88rem' : '0.92rem', fontWeight: 500,
              transition: 'background 0.2s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)'}
            >
              <Gift size={18} style={{ flexShrink: 0, color: accentLight }} />
              <span style={{ flex: 1 }}>Access the <strong style={{ color: '#e2e8f0' }}>Wheel game</strong> and earn XP</span>
              <ExternalLink size={14} style={{ color: '#475569' }} />
            </Link>

            {/* XP Bonus */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: isMobile ? '13px 14px' : '16px 18px',
              background: 'rgba(34, 197, 94, 0.04)', borderLeft: '3px solid #34d399',
              borderRadius: 12, color: '#cbd5e1',
              fontSize: isMobile ? '0.88rem' : '0.92rem', fontWeight: 500,
            }}>
              <Zap size={18} style={{ flexShrink: 0, color: '#34d399' }} />
              <span>Minimum <strong style={{ color: '#34d399' }}>2x XP bonus</strong> — (NFT count + 1)x on every activity</span>
            </div>

            {/* Launchpad discount */}
            <Link to="/nft-launchpad" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: isMobile ? '13px 14px' : '16px 18px',
              background: `rgba(245, 158, 11, 0.04)`, borderLeft: `3px solid ${goldLight}`,
              borderRadius: 12, color: '#cbd5e1', textDecoration: 'none',
              fontSize: isMobile ? '0.88rem' : '0.92rem', fontWeight: 500,
              transition: 'background 0.2s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.04)'}
            >
              <Percent size={18} style={{ flexShrink: 0, color: goldLight }} />
              <span style={{ flex: 1 }}><strong style={{ color: goldLight }}>75% discount</strong> on NFT Launchpad — ~$4 → ~$1</span>
              <ExternalLink size={14} style={{ color: '#475569' }} />
            </Link>

            {/* Small tags */}
            <div style={{
              display: 'flex', gap: isMobile ? 6 : 8,
              flexWrap: 'wrap', marginTop: 4,
            }}>
              {[
                { icon: Rocket, text: 'Early Features', color: accentLight },
                { icon: Star, text: 'Priority Airdrops', color: goldLight },
                { icon: CheckCircle, text: 'Exclusive Quests', color: '#34d399' },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: 8,
                  color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500,
                }}>
                  <Icon size={13} style={{ color }} />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── XP Multiplier Table ── */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: 20, padding: isMobile ? '22px 18px' : '28px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 16 : 20 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Zap size={20} color={accentLight} />
            </div>
            <div>
              <h3 style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                XP Multiplier
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>(NFT count + 1)x on all activities</p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(5, 1fr)' : 'repeat(10, 1fr)',
            gap: isMobile ? 6 : 8,
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} style={{
                background: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.08)',
                borderRadius: 10, padding: isMobile ? '10px 4px' : '12px 6px',
                textAlign: 'center',
              }}>
                <div style={{ color: accentLight, fontWeight: 700, fontSize: isMobile ? '0.78rem' : '0.82rem' }}>{n}</div>
                <div style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 500, marginTop: 2 }}>NFT</div>
                <div style={{
                  marginTop: 4, padding: '2px 0',
                  borderTop: '1px solid rgba(255,255,255,0.03)',
                  color: '#f1f5f9', fontSize: isMobile ? '0.82rem' : '0.88rem', fontWeight: 700,
                }}>
                  {n + 1}x
                </div>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes nftFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
      </div>
    </div>
  )
}

export default EarlyAccessNFT
