import React, { useState, useEffect } from 'react'
import { getLeaderboard, getExtendedLeaderboard } from '../utils/xpUtils'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import { Trophy, Medal, Award, Users, TrendingUp, RefreshCw, ChevronDown } from 'lucide-react'

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([])
  const [extendedLeaderboard, setExtendedLeaderboard] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [showMore, setShowMore] = useState(false)
  const [hasMorePlayers, setHasMorePlayers] = useState(false)

  useEffect(() => {
    loadLeaderboard()
    // Refresh every 10 seconds
    const interval = setInterval(loadLeaderboard, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Loading leaderboard...')
      const data = await getLeaderboard()
      console.log('Leaderboard data received:', data)
      setLeaderboard(data)
      setLastUpdated(new Date())
      
      // Check if there are more players
      const extendedData = await getExtendedLeaderboard(10, 5)
      setHasMorePlayers(extendedData.length > 0)
    } catch (err) {
      console.error('Error loading leaderboard:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMorePlayers = async () => {
    try {
      setLoadingMore(true)
      const currentCount = leaderboard.length + extendedLeaderboard.length
      const moreData = await getExtendedLeaderboard(currentCount, 5)
      
      if (moreData.length > 0) {
        setExtendedLeaderboard(prev => [...prev, ...moreData])
        
        // Check if there are even more players
        const nextBatch = await getExtendedLeaderboard(currentCount + 5, 5)
        setHasMorePlayers(nextBatch.length > 0)
      } else {
        setHasMorePlayers(false)
      }
    } catch (err) {
      console.error('Error loading more players:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy size={24} style={{ color: '#e5e7eb' }} />
      case 2:
        return <Medal size={24} style={{ color: '#e5e7eb' }} />
      case 3:
        return <Award size={24} style={{ color: '#e5e7eb' }} />
      default:
        return <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#e5e7eb' }}>#{rank}</span>
    }
  }

  const getRankColor = (rank) => {
    // All ranks use white background
    return 'rgba(255, 255, 255, 0.1)'
  }

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="loading" style={{ marginBottom: '16px' }} />
          <p style={{ color: '#6b7280' }}>Loading leaderboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: '#ef4444' }}>Error loading leaderboard: {error}</p>
          <button onClick={loadLeaderboard} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="leaderboard">
      <EmbedMeta 
        title="Leaderboard - BaseHub"
        description="Check out the top players on BaseHub! See who has the most XP and compete for the top spot!"
        buttonText="View Leaderboard"
      />
      
      <BackButton />
      
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '16px',
            color: '#e5e7eb'
          }}>
            🏆
          </div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#e5e7eb'
          }}>
            Leaderboard
          </h1>
          <p style={{ 
            color: '#9ca3af',
            fontSize: '16px'
          }}>
            Top 10 players by total XP
          </p>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px',
            marginTop: '12px'
          }}>
            {lastUpdated && (
              <p style={{ 
                color: '#9ca3af',
                fontSize: '12px',
                margin: 0
              }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
            <button
              onClick={loadLeaderboard}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#e5e7eb',
                fontSize: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              <RefreshCw size={12} style={{ 
                animation: loading ? 'spin 1s linear infinite' : 'none' 
              }} />
              Refresh
            </button>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            color: '#6b7280'
          }}>
            <Users size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>No players yet. Be the first to play!</p>
          </div>
        ) : (
          <div style={{ marginBottom: '24px' }}>
            {leaderboard.map((player, index) => (
              <div
                key={player.wallet_address}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  marginBottom: '12px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  marginRight: '16px'
                }}>
                  {getRankIcon(index + 1)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <span style={{ 
                      fontWeight: 'bold', 
                      fontSize: '16px',
                      color: '#e5e7eb'
                    }}>
                      {formatAddress(player.wallet_address)}
                    </span>
                    {index < 3 && (
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#e5e7eb',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}>
                        TOP {index + 1}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    gap: '16px',
                    fontSize: '14px',
                    color: '#9ca3af'
                  }}>
                    <span>Level {player.level}</span>
                    <span>{player.total_xp} XP</span>
                    <span>{player.total_transactions} transactions</span>
                  </div>
                </div>

                <div style={{ 
                  textAlign: 'right',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <TrendingUp size={16} style={{ color: '#e5e7eb' }} />
                  <span style={{ 
                    fontWeight: 'bold',
                    color: '#e5e7eb',
                    fontSize: '16px'
                  }}>
                    {player.total_xp} XP
                  </span>
                </div>
              </div>
            ))}

            {/* Extended Leaderboard */}
            {extendedLeaderboard.map((player, index) => {
              const globalIndex = leaderboard.length + index + 1
              return (
                <div
                  key={player.wallet_address}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px',
                    marginBottom: '12px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    marginRight: '16px'
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#e5e7eb' }}>#{globalIndex}</span>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <span style={{ 
                        fontWeight: 'bold', 
                        fontSize: '16px',
                        color: '#e5e7eb'
                      }}>
                        {formatAddress(player.wallet_address)}
                      </span>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '16px',
                      fontSize: '14px',
                      color: '#9ca3af'
                    }}>
                      <span>Level {player.level}</span>
                      <span>{player.total_xp} XP</span>
                      <span>{player.total_transactions} transactions</span>
                    </div>
                  </div>

                  <div style={{ 
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <TrendingUp size={16} style={{ color: '#10b981' }} />
                    <span style={{ 
                      fontWeight: 'bold',
                      color: '#10b981',
                      fontSize: '16px'
                    }}>
                      {player.total_xp} XP
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Load More Button */}
            {hasMorePlayers && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  onClick={loadMorePlayers}
                  disabled={loadingMore}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    color: '#e5e7eb',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    opacity: loadingMore ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                    margin: '0 auto'
                  }}
                >
                  {loadingMore ? (
                    <>
                      <div className="loading" style={{ width: '16px', height: '16px' }} />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      And 5 more players...
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ 
          padding: '16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#e5e7eb'
          }}>
            🎯 How to climb the leaderboard:
          </h3>
          <ul style={{ 
            color: '#9ca3af', 
            fontSize: '14px',
            margin: 0,
            paddingLeft: '20px',
            textAlign: 'left'
          }}>
            <li>Play games to earn XP and level up</li>
            <li>XP determines your rank on the leaderboard</li>
            <li>Higher level players get more rewards</li>
            <li>Leaderboard updates in real-time</li>
          </ul>
        </div>

        <button
          onClick={loadLeaderboard}
          className="btn btn-secondary"
          style={{ 
            width: '100%',
            marginTop: '16px'
          }}
        >
          🔄 Refresh Leaderboard
        </button>
      </div>
    </div>
  )
}

export default Leaderboard
