import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { User, X, Zap, Target, Repeat, Calendar, Trophy, TrendingUp } from 'lucide-react'
import { getXP } from '../utils/xpUtils'
import { useQuestSystem } from '../hooks/useQuestSystem'
import { useSupabase } from '../hooks/useSupabase'

const UserProfile = () => {
  const { address, isConnected } = useAccount()
  const { questProgress } = useQuestSystem()
  const { supabase } = useSupabase()
  const [isOpen, setIsOpen] = useState(false)
  const [totalXP, setTotalXP] = useState(0)
  const [txCount, setTxCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Load user stats
  useEffect(() => {
    const loadUserStats = async () => {
      if (!isConnected || !address) {
        setTotalXP(0)
        setTxCount(0)
        return
      }

      setLoading(true)
      try {
        // Load XP
        const xp = await getXP(address)
        setTotalXP(xp)

        // Load transaction count from Supabase
        if (supabase) {
          // Try to get from players table first (total_transactions)
          const { data: player, error: playerError } = await supabase
            .from('players')
            .select('total_transactions')
            .eq('wallet_address', address.toLowerCase())
            .single()

          if (!playerError && player) {
            setTxCount(player.total_transactions || 0)
          } else {
            // Fallback: count from transactions table
            const { count, error: txError } = await supabase
              .from('transactions')
              .select('*', { count: 'exact', head: true })
              .eq('wallet_address', address.toLowerCase())

            if (!txError && count !== null) {
              setTxCount(count || 0)
            } else {
              // Final fallback: local storage
              const localTxKey = `tx_count_${address}`
              const localTxCount = localStorage.getItem(localTxKey)
              setTxCount(localTxCount ? parseInt(localTxCount) : 0)
            }
          }
        }
      } catch (error) {
        console.error('Error loading user stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserStats()
    // Refresh every 5 seconds
    const interval = setInterval(loadUserStats, 5000)
    return () => clearInterval(interval)
  }, [isConnected, address, supabase])

  if (!isConnected || !address) {
    return null
  }

  const currentDay = questProgress?.current_day || 1
  const questStats = questProgress?.quest_stats || {}
  const completedQuests = questProgress?.completed_quests || []

  // Calculate daily quest progress
  const getQuestProgress = () => {
    const quests = [
      { type: 'gmUsed', label: 'GM Messages', icon: '💬', current: questStats.gmUsed || 0, required: 1 },
      { type: 'gnUsed', label: 'GN Messages', icon: '🌙', current: questStats.gnUsed || 0, required: 1 },
      { type: 'gamesPlayed', label: 'Games Played', icon: '🎮', current: questStats.gamesPlayed || 0, required: 3 },
      { type: 'swapsCompleted', label: 'Swaps Completed', icon: '🔄', current: questStats.swapsCompleted || 0, required: 1 },
      { type: 'nftsMinted', label: 'NFTs Minted', icon: '🖼️', current: questStats.nftsMinted || 0, required: 1 },
    ]

    return quests.map(quest => {
      const questId = `${currentDay}-${quest.label}`
      const isCompleted = completedQuests.includes(questId)
      return {
        ...quest,
        isCompleted,
        progress: Math.min((quest.current / quest.required) * 100, 100)
      }
    })
  }

  const quests = getQuestProgress()
  const completedQuestsCount = quests.filter(q => q.isCompleted).length
  const totalQuestsCount = quests.length

  return (
    <>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
          transition: 'all 0.2s ease',
          marginLeft: '8px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
        }}
        title="User Profile"
      >
        <User size={18} style={{ color: 'white' }} />
      </button>

      {/* Profile Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.98)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
            className="token-list-scrollbar"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff'
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}>
                  <User size={24} style={{ color: 'white' }} />
                </div>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '4px'
                  }}>
                    Your Profile
                  </h2>
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontFamily: 'monospace'
                  }}>
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {/* Total XP */}
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <Zap size={16} style={{ color: '#60a5fa' }} />
                  <span style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontWeight: '500'
                  }}>
                    Total XP
                  </span>
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff'
                }}>
                  {loading ? '...' : totalXP.toLocaleString()}
                </div>
              </div>

              {/* Transaction Count */}
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <Repeat size={16} style={{ color: '#60a5fa' }} />
                  <span style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontWeight: '500'
                  }}>
                    Total TX
                  </span>
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff'
                }}>
                  {loading ? '...' : txCount.toLocaleString()}
                </div>
              </div>

              {/* Current Day */}
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <Calendar size={16} style={{ color: '#60a5fa' }} />
                  <span style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontWeight: '500'
                  }}>
                    Day
                  </span>
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff'
                }}>
                  {currentDay}
                </div>
              </div>

              {/* Quest Progress */}
              <div style={{
                padding: '16px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <Target size={16} style={{ color: '#60a5fa' }} />
                  <span style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    fontWeight: '500'
                  }}>
                    Quests
                  </span>
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff'
                }}>
                  {completedQuestsCount}/{totalQuestsCount}
                </div>
              </div>
            </div>

            {/* Daily Quests Section */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Trophy size={18} style={{ color: '#60a5fa' }} />
                Daily Quests (Day {currentDay})
              </h3>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {quests.map((quest, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      backgroundColor: quest.isCompleted 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(30, 41, 59, 0.6)',
                      borderRadius: '10px',
                      border: `1px solid ${quest.isCompleted 
                        ? 'rgba(34, 197, 94, 0.3)' 
                        : 'rgba(59, 130, 246, 0.2)'}`
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '16px' }}>{quest.icon}</span>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#ffffff'
                        }}>
                          {quest.label}
                        </span>
                      </div>
                      {quest.isCompleted && (
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(34, 197, 94, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '12px' }}>✓</span>
                        </div>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${quest.progress}%`,
                          height: '100%',
                          backgroundColor: quest.isCompleted ? '#22c55e' : '#60a5fa',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        fontWeight: '500',
                        minWidth: '50px',
                        textAlign: 'right'
                      }}>
                        {quest.current}/{quest.required}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Bonus */}
            {questProgress?.weekly_bonus_earned && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Trophy size={18} style={{ color: '#fbbf24' }} />
                <span style={{
                  fontSize: '13px',
                  color: '#ffffff',
                  fontWeight: '500'
                }}>
                  Weekly Bonus Earned! 🎉
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default UserProfile

