import React, { useState, useEffect } from 'react'
import { useFarcaster } from '../contexts/FarcasterContext'
import ShareButton from '../components/ShareButton'
import { Share2, User, MessageCircle, Calendar, Hash, ExternalLink } from 'lucide-react'

const SharePage = () => {
  const { sharedCast, isShareContext, isReady } = useFarcaster()
  const [urlParams, setUrlParams] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Extract URL parameters for immediate access
    const params = new URLSearchParams(window.location.search)
    const castHash = params.get('castHash')
    const castFid = params.get('castFid')
    const viewerFid = params.get('viewerFid')
    
    if (castHash || castFid || viewerFid) {
      setUrlParams({ castHash, castFid, viewerFid })
      console.log('📤 URL parameters detected:', { castHash, castFid, viewerFid })
    }
    
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          animation: 'pulse 2s infinite'
        }}>
          <Share2 size={24} />
        </div>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 'bold' }}>
          Analyzing Cast...
        </h2>
        <p style={{ margin: '0', opacity: 0.8, fontSize: '14px' }}>
          Getting cast information
        </p>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    )
  }

  // If we have shared cast data from SDK
  if (isShareContext && sharedCast) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%)',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Share2 size={20} />
            </div>
            <div>
              <h1 style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                Cast Shared to BaseHub
              </h1>
              <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                Analyzing cast from @{sharedCast.author.username}
              </p>
            </div>
          </div>

          {/* Cast Information */}
          <div style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              {sharedCast.author.pfpUrl && (
                <img 
                  src={sharedCast.author.pfpUrl} 
                  alt={sharedCast.author.username}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              )}
              <div>
                <div style={{ fontWeight: '600', color: '#1f2937' }}>
                  @{sharedCast.author.username}
                </div>
                {sharedCast.author.displayName && (
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {sharedCast.author.displayName}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{
              fontSize: '16px',
              lineHeight: '1.5',
              color: '#374151',
              marginBottom: '12px'
            }}>
              {sharedCast.text}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Hash size={12} />
                {sharedCast.hash.slice(0, 8)}...
              </div>
              {sharedCast.timestamp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  {new Date(sharedCast.timestamp).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => window.open(`https://warpcast.com/${sharedCast.author.username}`, '_blank')}
              style={{
                flex: 1,
                minWidth: '140px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)'
                e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = 'none'
              }}
            >
              <User size={16} />
              View Profile
            </button>
            
            <button
              onClick={() => window.open(`https://warpcast.com/~/conversations/${sharedCast.hash}`, '_blank')}
              style={{
                flex: 1,
                minWidth: '140px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)'
                e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = 'none'
              }}
            >
              <MessageCircle size={16} />
              View Cast
            </button>
          </div>

          {/* Share this cast */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              Share this cast
            </h3>
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Share this cast with others so they can also explore it on BaseHub!
            </p>
            <ShareButton
              title="Shared Cast"
              description="Check out this cast on BaseHub"
              castData={sharedCast}
              isCastShare={true}
              style={{ width: '100%' }}
            />
          </div>

          {/* BaseHub Actions */}
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              What would you like to do with this cast?
            </h3>
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              You can play games, earn XP, or explore BaseHub features with this cast context.
            </p>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  background: 'white',
                  color: '#3b82f6',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#3b82f6'
                  e.target.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white'
                  e.target.style.color = '#3b82f6'
                }}
              >
                Play Games
              </button>
              <button
                onClick={() => window.location.href = '/leaderboard'}
                style={{
                  background: 'white',
                  color: '#10b981',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#10b981'
                  e.target.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white'
                  e.target.style.color = '#10b981'
                }}
              >
                View Leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If we only have URL parameters (server-side rendering case)
  if (urlParams.castHash || urlParams.castFid) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%)',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Share2 size={20} />
            </div>
            <div>
              <h1 style={{ margin: '0', fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                Cast Shared to BaseHub
              </h1>
              <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                Loading cast information...
              </p>
            </div>
          </div>

          <div style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <Hash size={16} />
              <span style={{ fontWeight: '600', color: '#1f2937' }}>
                Cast Hash: {urlParams.castHash}
              </span>
            </div>
            {urlParams.castFid && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <User size={16} />
                <span style={{ color: '#6b7280' }}>
                  Author FID: {urlParams.castFid}
                </span>
              </div>
            )}
            {urlParams.viewerFid && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <User size={16} />
                <span style={{ color: '#6b7280' }}>
                  Viewer FID: {urlParams.viewerFid}
                </span>
              </div>
            )}
          </div>

          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#6b7280'
          }}>
            <p style={{ margin: '0 0 16px 0' }}>
              Loading full cast details...
            </p>
            <div style={{
              width: '24px',
              height: '24px',
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    )
  }

  // Fallback - no cast data
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '400px',
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          margin: '0 auto 20px auto'
        }}>
          <Share2 size={24} />
        </div>
        <h1 style={{
          margin: '0 0 12px 0',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1f2937'
        }}>
          Welcome to BaseHub
        </h1>
        <p style={{
          margin: '0 0 24px 0',
          fontSize: '14px',
          color: '#6b7280',
          lineHeight: '1.5'
        }}>
          No cast was shared. Explore BaseHub to play games and earn XP on Base network!
        </p>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-1px)'
            e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = 'none'
          }}
        >
          Start Playing
        </button>
      </div>
    </div>
  )
}

export default SharePage
