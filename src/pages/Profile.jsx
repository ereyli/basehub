import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useReadContract } from 'wagmi'
import { 
  User, ArrowLeft, Zap, Repeat, Calendar, Trophy, TrendingUp, 
  Award, Target, CheckCircle, Clock, BarChart3, Activity,
  Gamepad2, Coins, Layers, MessageSquare, RefreshCw, Medal, Sparkles
} from 'lucide-react'
import { getXP } from '../utils/xpUtils'
import { useQuestSystem } from '../hooks/useQuestSystem'
import { useSupabase } from '../hooks/useSupabase'
import BackButton from '../components/BackButton'
import { EARLY_ACCESS_CONFIG, EARLY_ACCESS_ABI } from '../config/earlyAccessNFT'

const Profile = () => {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { questProgress } = useQuestSystem()
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(true)
  const [totalXP, setTotalXP] = useState(0)
  const [level, setLevel] = useState(1)
  const [txCount, setTxCount] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [leaderboardRank, setLeaderboardRank] = useState(null)
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    swapsCompleted: 0,
    nftsMinted: 0,
    gmUsed: 0,
    gnUsed: 0,
    totalVolume: 0
  })
  
  // Get Early Access NFT balance - always call hook but disable when conditions not met
  const shouldFetchNFTBalance = !!address && !!EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS && !!isConnected
  const { data: nftBalance, error: nftBalanceError } = useReadContract({
    address: shouldFetchNFTBalance ? (EARLY_ACCESS_CONFIG.CONTRACT_ADDRESS || undefined) : undefined,
    abi: EARLY_ACCESS_ABI,
    functionName: 'balanceOf',
    args: shouldFetchNFTBalance && address ? [address] : undefined,
    query: {
      enabled: shouldFetchNFTBalance,
      refetchInterval: shouldFetchNFTBalance ? 10000 : false, // Disable refetch when not enabled
      retry: 1,
      retryOnMount: false,
      gcTime: 0 // Disable garbage collection to prevent re-fetches
    }
  })
  
  // Safely convert to number, default to 0 if error or undefined
  const userNFTCount = (shouldFetchNFTBalance && nftBalance && !nftBalanceError) ? Number(nftBalance) : 0

  // Calculate level from XP
  const calculateLevel = (xp) => {
    return Math.floor(xp / 100) + 1
  }

  // Load all user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!isConnected || !address) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // Load XP and level
        const xp = await getXP(address)
        console.log('📊 Profile XP loaded:', xp)
        setTotalXP(xp)
        setLevel(calculateLevel(xp))

        // Load player data from Supabase
        if (supabase) {
          console.log('🔍 Loading profile data for:', address)
          
          // Try both lowercase and original case for wallet_address
          const walletAddressLower = address.toLowerCase()
          const { data: player, error: playerError } = await supabase
            .from('players')
            .select('*')
            .or(`wallet_address.eq.${walletAddressLower},wallet_address.eq.${address}`)
            .single()

          console.log('👤 Player data:', { player, playerError })

          if (!playerError && player) {
            setLevel(player.level || calculateLevel(xp))
            // Use total_transactions from players table (most accurate)
            console.log('📊 Total transactions from player:', player.total_transactions)
            setTxCount(player.total_transactions || 0)
            
            // Calculate leaderboard rank
            const { data: allPlayers, error: rankError } = await supabase
              .from('players')
              .select('wallet_address, total_xp')
              .order('total_xp', { ascending: false })

            if (!rankError && allPlayers) {
              const rank = allPlayers.findIndex(p => 
                p.wallet_address.toLowerCase() === walletAddressLower || 
                p.wallet_address === address
              ) + 1
              console.log('🏆 Leaderboard rank:', rank, 'out of', allPlayers.length)
              setLeaderboardRank(rank > 0 ? rank : null)
            }
          } else {
            console.log('⚠️ Player not found, trying transactions count')
            // If player doesn't exist, try to count from transactions table
            const { count: txCountResult, error: txCountError } = await supabase
              .from('transactions')
              .select('*', { count: 'exact', head: true })
              .or(`wallet_address.eq.${walletAddressLower},wallet_address.eq.${address}`)

            console.log('📊 Transaction count result:', { txCountResult, txCountError })
            if (!txCountError && txCountResult !== null) {
              setTxCount(txCountResult || 0)
            }
          }

          // Load ALL transactions for statistics (not just recent 10)
          // Try both lowercase and original case
          const { data: allTransactions, error: allTxError } = await supabase
            .from('transactions')
            .select('*')
            .or(`wallet_address.eq.${walletAddressLower},wallet_address.eq.${address}`)
            .order('created_at', { ascending: false })

          console.log('📋 All transactions:', { 
            count: allTransactions?.length || 0, 
            error: allTxError,
            sample: allTransactions?.slice(0, 3) 
          })

          if (!allTxError && allTransactions && allTransactions.length > 0) {
            // Set recent transactions (first 10)
            setRecentTransactions(allTransactions.slice(0, 10) || [])
            
            // Calculate stats from ALL transactions
            const gameTypes = allTransactions.map(tx => tx.game_type)
            console.log('🎮 Game types found:', gameTypes)
            console.log('🎮 Unique game types:', [...new Set(gameTypes)])
            
            const newStats = {
              gamesPlayed: gameTypes.filter(t => ['GM_GAME', 'GN_GAME', 'FLIP_GAME', 'DICE_ROLL', 'LUCKY_NUMBER', 'SLOT_GAME'].includes(t)).length,
              swapsCompleted: gameTypes.filter(t => t === 'SWAP' || t === 'SWAP_VOLUME').length,
              nftsMinted: gameTypes.filter(t => t === 'NFT_MINT').length,
              gmUsed: gameTypes.filter(t => t === 'GM_GAME').length,
              gnUsed: gameTypes.filter(t => t === 'GN_GAME').length,
              totalVolume: allTransactions
                .filter(tx => tx.swap_amount_usd)
                .reduce((sum, tx) => sum + (parseFloat(tx.swap_amount_usd) || 0), 0)
            }
            console.log('📈 Calculated stats:', newStats)
            setStats(newStats)
            
            // If player doesn't exist but we have transactions, update tx count
            if (playerError && allTransactions.length > 0) {
              setTxCount(allTransactions.length)
            }
          } else {
            console.log('⚠️ No transactions found or error:', { allTxError, count: allTransactions?.length || 0 })
            if (!playerError && player) {
              // If transactions query fails but player exists, use player's total_transactions
              setTxCount(player.total_transactions || 0)
            }
          }

          // Quest progress is loaded automatically by useQuestSystem hook
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
    // Only load once when component mounts or address changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  if (!isConnected || !address) {
    return (
      <div style={styles.container}>
        <BackButton />
        <div style={styles.notConnected}>
          <User size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
          <h2 style={styles.notConnectedTitle}>Not Connected</h2>
          <p style={styles.notConnectedText}>
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    )
  }

  const currentDay = questProgress?.current_day || 1
  const questStats = questProgress?.quest_stats || {}
  const completedQuests = questProgress?.completed_quests || []

  // Get daily quests - must match DailyQuestSystem quests
  const getDailyQuests = () => {
    // Calculate required count based on current day (Day 1 = 1, Day 2 = 2, etc.)
    const requiredCount = currentDay
    
    const quests = [
      { type: 'gmUsed', label: 'GM Messages', title: 'GM Game', icon: MessageSquare, current: questStats.gmUsed || 0, required: requiredCount, xp: 50 },
      { type: 'gnUsed', label: 'GN Messages', title: 'GN Game', icon: MessageSquare, current: questStats.gnUsed || 0, required: requiredCount, xp: 50 },
      { type: 'gamesPlayed', label: 'Games Played', title: 'Coin Flip Game', icon: Gamepad2, current: questStats.gamesPlayed || 0, required: requiredCount, xp: 50 },
      { type: 'swapsCompleted', label: 'Swaps Completed', title: 'Swap', icon: Repeat, current: questStats.swapsCompleted || 0, required: requiredCount, xp: 1000 },
    ]

    return quests.map(quest => {
      // Check both formats: using label and using title (as stored in DailyQuestSystem)
      const questIdByLabel = `${currentDay}-${quest.label}`
      const questIdByTitle = `${currentDay}-${quest.title}`
      // A quest is completed if it's in completed_quests OR if current >= required
      const isCompletedInDB = completedQuests.includes(questIdByLabel) || completedQuests.includes(questIdByTitle)
      const isCompletedByProgress = quest.current >= quest.required
      const isCompleted = isCompletedInDB || isCompletedByProgress
      
      // If quest is completed in DB but current progress is less, show it as completed
      // with progress at 100% for visual consistency
      const displayCurrent = isCompletedInDB && quest.current < quest.required ? quest.required : quest.current
      const progress = isCompleted ? 100 : Math.min((quest.current / quest.required) * 100, 100)
      
      return {
        ...quest,
        isCompleted,
        current: displayCurrent, // Use displayCurrent for visual consistency
        progress
      }
    })
  }

  const dailyQuests = getDailyQuests()
  const completedQuestsCount = dailyQuests.filter(q => q.isCompleted).length
  const totalQuestsCount = dailyQuests.length

  // Format transaction type
  const formatTransactionType = (type) => {
    const types = {
      'GM_GAME': 'GM Message',
      'GN_GAME': 'GN Message',
      'FLIP_GAME': 'Coin Flip',
      'DICE_ROLL': 'Dice Roll',
      'LUCKY_NUMBER': 'Lucky Number',
      'SLOT_GAME': 'Slot Game',
      'SWAP': 'Token Swap',
      'NFT_MINT': 'NFT Mint',
      'SWAP_VOLUME': 'Swap Volume',
      'SWAP_MILESTONE_500': 'Swap Milestone'
    }
    return types[type] || type
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Inject CSS animations
  useEffect(() => {
    // Check if we're in browser environment
    if (typeof document === 'undefined') return
    
    const styleId = 'nft-float-animations'
    let styleElement = document.getElementById(styleId)
    
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      styleElement.textContent = `
        @keyframes nftFloat {
          0%, 100% {
            transform: translateY(0px) rotateY(0deg) rotateX(0deg);
          }
          25% {
            transform: translateY(-12px) rotateY(5deg) rotateX(3deg);
          }
          50% {
            transform: translateY(-8px) rotateY(0deg) rotateX(0deg);
          }
          75% {
            transform: translateY(-12px) rotateY(-5deg) rotateX(-3deg);
          }
        }
      `
      if (document.head) {
        document.head.appendChild(styleElement)
      }
    }
    
    return () => {
      // Only cleanup if we're in browser and element exists
      if (typeof document !== 'undefined') {
        const element = document.getElementById(styleId)
        if (element && element.parentNode) {
          element.parentNode.removeChild(element)
        }
      }
    }
  }, [])

  return (
    <div style={styles.container}>
        <BackButton />
      
      <div style={styles.content}>
        {/* Header Section */}
        <div style={styles.header}>
          <div style={styles.profileHeader}>
            <div style={styles.avatar}>
              <User size={32} style={{ color: 'white' }} />
            </div>
            <div style={styles.profileInfo}>
              <h1 style={styles.title}>Your Profile</h1>
              <p style={styles.address}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={styles.loading}>
            <RefreshCw size={24} className="spinning" style={{ color: '#60a5fa' }} />
            <p style={styles.loadingText}>Loading your profile...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statIcon}>
                  <Zap size={20} style={{ color: '#60a5fa' }} />
                </div>
                <div style={styles.statContent}>
                  <div style={styles.statLabel}>Total XP</div>
                  <div style={styles.statValue}>{totalXP.toLocaleString()}</div>
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statIcon}>
                  <Award size={20} style={{ color: '#60a5fa' }} />
                </div>
                <div style={styles.statContent}>
                  <div style={styles.statLabel}>Level</div>
                  <div style={styles.statValue}>{level}</div>
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statIcon}>
                  <Repeat size={20} style={{ color: '#60a5fa' }} />
                </div>
                <div style={styles.statContent}>
                  <div style={styles.statLabel}>Total TX</div>
                  <div style={styles.statValue}>{txCount.toLocaleString()}</div>
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statIcon}>
                  <Calendar size={20} style={{ color: '#60a5fa' }} />
                </div>
                <div style={styles.statContent}>
                  <div style={styles.statLabel}>Quest Day</div>
                  <div style={styles.statValue}>{currentDay}</div>
                </div>
              </div>

              {leaderboardRank && (
                <div style={{
                  ...styles.statCard,
                  background: leaderboardRank <= 3 
                    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)'
                    : 'rgba(30, 41, 59, 0.6)',
                  border: leaderboardRank <= 3
                    ? '1px solid rgba(251, 191, 36, 0.3)'
                    : '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <div style={{
                    ...styles.statIcon,
                    background: leaderboardRank <= 3
                      ? 'rgba(251, 191, 36, 0.2)'
                      : 'rgba(59, 130, 246, 0.15)'
                  }}>
                    <Medal size={20} style={{ 
                      color: leaderboardRank <= 3 ? '#fbbf24' : '#60a5fa' 
                    }} />
                  </div>
                  <div style={styles.statContent}>
                    <div style={styles.statLabel}>Leaderboard Rank</div>
                    <div style={{
                      ...styles.statValue,
                      color: leaderboardRank <= 3 ? '#fbbf24' : '#ffffff'
                    }}>
                      #{leaderboardRank}
                      {leaderboardRank === 1 && <Medal size={16} style={{ color: '#fbbf24', marginLeft: '4px', display: 'inline-block' }} />}
                      {leaderboardRank === 2 && <Medal size={16} style={{ color: '#9ca3af', marginLeft: '4px', display: 'inline-block' }} />}
                      {leaderboardRank === 3 && <Medal size={16} style={{ color: '#d97706', marginLeft: '4px', display: 'inline-block' }} />}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Daily Quests */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>
                  <Trophy size={20} style={{ color: '#60a5fa', marginRight: '8px' }} />
                  Daily Quests (Day {currentDay})
                </h2>
                <div style={styles.questProgress}>
                  {completedQuestsCount}/{totalQuestsCount} Completed
                </div>
              </div>

              <div style={styles.questsList}>
                {dailyQuests.map((quest, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.questCard,
                      borderColor: quest.isCompleted 
                        ? 'rgba(34, 197, 94, 0.3)' 
                        : 'rgba(59, 130, 246, 0.2)',
                      backgroundColor: quest.isCompleted 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(30, 41, 59, 0.6)'
                    }}
                  >
                    <div style={styles.questHeader}>
                      <div style={styles.questLeft}>
                        <div style={{
                          ...styles.questIcon,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: '#60a5fa'
                        }}>
                          {React.createElement(quest.icon, { size: 18 })}
                        </div>
                        <div>
                          <div style={styles.questTitle}>{quest.label}</div>
                          <div style={styles.questXP}>+{quest.xp} XP</div>
                        </div>
                      </div>
                      {quest.isCompleted && (
                        <div style={styles.completedBadge}>
                          <CheckCircle size={16} />
                          <span>Completed</span>
                        </div>
                      )}
                    </div>
                    <div style={styles.progressContainer}>
                      <div style={styles.progressBar}>
                        <div 
                          style={{
                            ...styles.progressFill,
                            width: `${quest.progress}%`,
                            backgroundColor: quest.isCompleted ? '#22c55e' : '#60a5fa'
                          }}
                        />
                      </div>
                      <span style={styles.progressText}>
                        {quest.current}/{quest.required}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {questProgress?.weekly_bonus_earned && (
                <div style={styles.weeklyBonus}>
                  <Trophy size={20} style={{ color: '#fbbf24' }} />
                  <div>
                    <div style={styles.weeklyBonusTitle}>Weekly Bonus Earned</div>
                    <div style={styles.weeklyBonusText}>
                      You've completed all 7 days of quests
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Early Access NFTs */}
            {userNFTCount > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>
                    <Sparkles size={20} style={{ color: '#60a5fa', marginRight: '8px' }} />
                    Early Access NFTs
                  </h2>
                  <div style={styles.nftCountBadge}>
                    {userNFTCount} {userNFTCount === 1 ? 'NFT' : 'NFTs'}
                  </div>
                </div>

                <div style={styles.xpBoostBanner}>
                  <div style={styles.xpBoostIcon}>
                    <Zap size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={styles.xpBoostTitle}>2x XP Boost Active</div>
                    <div style={styles.xpBoostText}>
                      Holding this pass doubles all XP you earn across the platform.
                    </div>
                  </div>
                </div>

                <div style={styles.nftGrid}>
                  {Array.from({ length: userNFTCount }).map((_, index) => {
                    const animationDelay = index * 0.3
                    const animationDuration = 4 + (index % 3) // Vary between 4-6 seconds
                    return (
                      <div
                        key={index}
                        style={{
                          ...styles.nftCard,
                          animationDelay: `${animationDelay}s`,
                          animationDuration: `${animationDuration}s`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)'
                          e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = ''
                          e.currentTarget.style.boxShadow = ''
                        }}
                      >
                        <div style={styles.nftImageWrapper}>
                          <img
                            src="/BaseHubNFT.png"
                            alt={`Early Access Pass #${index + 1}`}
                            style={styles.nftImage}
                          />
                        </div>
                        <div style={styles.nftLabel}>
                          Early Access Pass #{index + 1}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            {recentTransactions.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  <BarChart3 size={20} style={{ color: '#60a5fa', marginRight: '8px' }} />
                  Recent Transactions
                </h2>
                <div style={styles.transactionsList}>
                  {recentTransactions.map((tx, index) => (
                    <div key={index} style={styles.transactionCard}>
                      <div style={styles.transactionLeft}>
                        <div style={styles.transactionIcon}>
                          {tx.game_type === 'SWAP' ? (
                            <RefreshCw size={16} />
                          ) : tx.game_type === 'NFT_MINT' ? (
                            <Layers size={16} />
                          ) : (
                            <Gamepad2 size={16} />
                          )}
                        </div>
                        <div>
                          <div style={styles.transactionType}>
                            {formatTransactionType(tx.game_type)}
                          </div>
                          <div style={styles.transactionDate}>
                            {formatDate(tx.created_at)}
                          </div>
                        </div>
                      </div>
                      <div style={styles.transactionRight}>
                        {tx.xp_earned && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <div style={styles.transactionXP}>
                              +{tx.xp_earned} XP
                              {tx.bonus_xp && tx.bonus_xp > 0 && (
                                <span style={{ 
                                  fontSize: '11px', 
                                  color: '#10b981', 
                                  marginLeft: '6px',
                                  fontWeight: '500'
                                }}>
                                  (2x)
                                </span>
                              )}
                            </div>
                            {tx.bonus_xp && tx.bonus_xp > 0 && (
                              <div style={{
                                fontSize: '11px',
                                color: '#10b981',
                                fontWeight: '500'
                              }}>
                                +{tx.bonus_xp} XP bonus
                              </div>
                            )}
                          </div>
                        )}
                        {tx.swap_amount_usd && (
                          <div style={styles.transactionAmount}>
                            ${parseFloat(tx.swap_amount_usd).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
    paddingTop: '80px',
    paddingBottom: '40px'
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  },
  header: {
    marginBottom: '32px'
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '24px',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '20px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)'
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
  },
  profileInfo: {
    flex: 1
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '4px'
  },
  address: {
    margin: 0,
    fontSize: '14px',
    color: '#9ca3af',
    fontFamily: 'monospace'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px'
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: '16px'
  },
  notConnected: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center'
  },
  notConnectedTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '8px'
  },
  notConnectedText: {
    fontSize: '16px',
    color: '#9ca3af'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '16px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    transition: 'all 0.2s ease'
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  statContent: {
    flex: 1
  },
  statLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff'
  },
  section: {
    marginBottom: '32px',
    padding: '24px',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '20px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center'
  },
  questProgress: {
    padding: '6px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  activityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px'
  },
  activityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  activityInfo: {
    flex: 1
  },
  activityLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '4px'
  },
  activityValue: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff'
  },
  questsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  questCard: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid',
    transition: 'all 0.2s ease'
  },
  questHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  questLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1
  },
  questIcon: {
    fontSize: '24px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '10px'
  },
  questTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '2px'
  },
  questXP: {
    fontSize: '12px',
    color: '#60a5fa',
    fontWeight: '500'
  },
  completedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.3)'
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  progressBar: {
    flex: 1,
    height: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: '500',
    minWidth: '50px',
    textAlign: 'right'
  },
  weeklyBonus: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    marginTop: '16px'
  },
  weeklyBonusTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px'
  },
  weeklyBonusText: {
    fontSize: '14px',
    color: '#9ca3af'
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  transactionCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.1)',
    transition: 'all 0.2s ease'
  },
  transactionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1
  },
  transactionIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#60a5fa'
  },
  transactionType: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '2px'
  },
  transactionDate: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  transactionRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px'
  },
  transactionXP: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#60a5fa'
  },
  transactionAmount: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#9ca3af'
  },
  xpBoostBanner: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(37, 99, 235, 0.12) 100%)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    marginBottom: '18px',
    boxShadow: '0 6px 18px rgba(59, 130, 246, 0.25)'
  },
  xpBoostIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#93c5fd',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
  },
  xpBoostTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#e5e7eb'
  },
  xpBoostText: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#cbd5e1'
  },
  nftCountBadge: {
    padding: '6px 12px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  nftGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  },
  nftCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    transition: 'all 0.3s ease',
    cursor: 'default',
    animation: 'nftFloat 5s ease-in-out infinite',
    transformStyle: 'preserve-3d',
    perspective: '1000px'
  },
  nftImageWrapper: {
    position: 'relative',
    width: '100%',
    paddingTop: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '12px',
    background: 'rgba(15, 23, 42, 0.4)'
  },
  nftImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
    border: '2px solid rgba(59, 130, 246, 0.2)'
  },
  nftLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
    textAlign: 'center',
    padding: '8px',
    background: 'rgba(15, 23, 42, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  }
}

export default Profile

