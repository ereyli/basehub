import React, { useState, useEffect } from 'react'
import { Calendar, CheckCircle, Star, Trophy, Zap, Target, Gift, RotateCcw } from 'lucide-react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'

const DailyQuestSystem = () => {
  const [quests, setQuests] = useState([])
  const [currentDay, setCurrentDay] = useState(1)
  const [completedQuests, setCompletedQuests] = useState([])
  const [weeklyBonus, setWeeklyBonus] = useState(false)
  const [totalXP, setTotalXP] = useState(0)
  const [isInFarcaster, setIsInFarcaster] = useState(false)

  // Check if in Farcaster environment
  useEffect(() => {
    if (!shouldUseRainbowKit()) {
      try {
        const farcasterContext = useFarcaster()
        setIsInFarcaster(farcasterContext?.isInFarcaster || false)
      } catch (error) {
        setIsInFarcaster(false)
      }
    }
  }, [])

  // Initialize 7-day quest system
  useEffect(() => {
    initializeQuests()
    loadProgress()
  }, [])

  const initializeQuests = () => {
    const questTemplates = [
      // Day 1 - Easy Start
      {
        day: 1,
        title: "Welcome to BaseHub!",
        description: "Play your first game",
        xpReward: 50,
        icon: <Zap size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gamesPlayed: 1 }
      },
      {
        day: 1,
        title: "Share Your First Cast",
        description: "Share a cast about BaseHub",
        xpReward: 100,
        icon: <Star size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { castsShared: 1 }
      },

      // Day 2 - Building Momentum
      {
        day: 2,
        title: "Game Master",
        description: "Play 3 different games",
        xpReward: 150,
        icon: <Target size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { gamesPlayed: 3 }
      },
      {
        day: 2,
        title: "Social Butterfly",
        description: "Share 2 casts with BaseHub",
        xpReward: 200,
        icon: <Star size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { castsShared: 2 }
      },

      // Day 3 - Deploy Phase
      {
        day: 3,
        title: "Token Creator",
        description: "Deploy your first token",
        xpReward: 300,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokensDeployed: 1 }
      },
      {
        day: 3,
        title: "Community Builder",
        description: "Share 3 casts and play 5 games",
        xpReward: 250,
        icon: <Trophy size={20} />,
        color: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        requirements: { castsShared: 3, gamesPlayed: 5 }
      },

      // Day 4 - Advanced Features
      {
        day: 4,
        title: "NFT Creator",
        description: "Deploy an ERC721 NFT contract",
        xpReward: 400,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { nftsDeployed: 1 }
      },
      {
        day: 4,
        title: "Base Network Explorer",
        description: "Complete 10 transactions",
        xpReward: 350,
        icon: <Zap size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { transactions: 10 }
      },

      // Day 5 - Power User
      {
        day: 5,
        title: "Multi-Token Master",
        description: "Deploy 3 different tokens",
        xpReward: 500,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { tokensDeployed: 3 }
      },
      {
        day: 5,
        title: "Social Influencer",
        description: "Share 5 casts and get 10 interactions",
        xpReward: 450,
        icon: <Star size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { castsShared: 5, interactions: 10 }
      },

      // Day 6 - Advanced Deployer
      {
        day: 6,
        title: "Contract Deployer",
        description: "Deploy ERC1155 multi-token contract",
        xpReward: 600,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc1155Deployed: 1 }
      },
      {
        day: 6,
        title: "Base Network Champion",
        description: "Complete 20 transactions",
        xpReward: 550,
        icon: <Zap size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { transactions: 20 }
      },

      // Day 7 - Final Challenge
      {
        day: 7,
        title: "BaseHub Legend",
        description: "Complete all previous quests",
        xpReward: 1000,
        icon: <Trophy size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { allQuestsCompleted: true }
      },
      {
        day: 7,
        title: "Ultimate Socialite",
        description: "Share 10 casts and complete 15 games",
        xpReward: 800,
        icon: <Star size={20} />,
        color: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        requirements: { castsShared: 10, gamesPlayed: 15 }
      }
    ]

    setQuests(questTemplates)
  }

  const loadProgress = () => {
    // Load from localStorage
    const savedProgress = localStorage.getItem('basehub-quest-progress')
    if (savedProgress) {
      const progress = JSON.parse(savedProgress)
      setCompletedQuests(progress.completedQuests || [])
      setCurrentDay(progress.currentDay || 1)
      setWeeklyBonus(progress.weeklyBonus || false)
      setTotalXP(progress.totalXP || 0)
    }
  }

  const saveProgress = () => {
    const progress = {
      completedQuests,
      currentDay,
      weeklyBonus,
      totalXP,
      lastUpdated: new Date().toISOString()
    }
    localStorage.setItem('basehub-quest-progress', JSON.stringify(progress))
  }

  const completeQuest = (questId) => {
    if (!completedQuests.includes(questId)) {
      const quest = quests.find(q => q.id === questId)
      if (quest) {
        setCompletedQuests([...completedQuests, questId])
        setTotalXP(totalXP + quest.xpReward)
        
        // Check if all quests for current day are completed
        const dayQuests = quests.filter(q => q.day === currentDay)
        const completedDayQuests = dayQuests.filter(q => completedQuests.includes(q.id))
        
        if (completedDayQuests.length === dayQuests.length - 1) {
          // Move to next day
          if (currentDay < 7) {
            setCurrentDay(currentDay + 1)
          } else {
            // Week completed!
            setWeeklyBonus(true)
            setTotalXP(totalXP + 2000) // Weekly bonus
          }
        }
        
        saveProgress()
      }
    }
  }

  const resetWeek = () => {
    setCompletedQuests([])
    setCurrentDay(1)
    setWeeklyBonus(false)
    setTotalXP(0)
    saveProgress()
  }

  const getCurrentDayQuests = () => {
    return quests.filter(q => q.day === currentDay)
  }

  const getQuestProgress = () => {
    const dayQuests = getCurrentDayQuests()
    const completed = dayQuests.filter(q => completedQuests.includes(q.id)).length
    return { completed, total: dayQuests.length }
  }

  const progress = getQuestProgress()

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      borderRadius: '16px',
      padding: '24px',
      margin: '20px 0',
      border: '1px solid #e2e8f0'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <h2 style={{
              margin: '0',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              7-Day Quest System
            </h2>
            <p style={{
              margin: '0',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Day {currentDay}/7 • {progress.completed}/{progress.total} completed
            </p>
          </div>
        </div>

        {weeklyBonus && (
          <button
            onClick={resetWeek}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <RotateCcw size={16} />
            New Week
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{
        background: '#e5e7eb',
        borderRadius: '8px',
        height: '8px',
        marginBottom: '24px',
        overflow: 'hidden'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          height: '100%',
          width: `${(progress.completed / progress.total) * 100}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Current Day Quests */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1f2937'
        }}>
          Day {currentDay} Quests
        </h3>
        <div style={{
          display: 'grid',
          gap: '12px'
        }}>
          {getCurrentDayQuests().map((quest, index) => (
            <div
              key={`${quest.day}-${index}`}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: completedQuests.includes(`${quest.day}-${index}`) ? 0.6 : 1
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                background: quest.color,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                {quest.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{
                  margin: '0 0 4px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937'
                }}>
                  {quest.title}
                </h4>
                <p style={{
                  margin: '0',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  {quest.description}
                </p>
              </div>
              <div style={{
                textAlign: 'right'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#10b981'
                }}>
                  +{quest.xpReward} XP
                </div>
                {completedQuests.includes(`${quest.day}-${index}`) && (
                  <CheckCircle size={16} style={{ color: '#10b981', marginTop: '4px' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Bonus */}
      {weeklyBonus && (
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '12px',
          padding: '16px',
          color: 'white',
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          <Trophy size={24} style={{ marginBottom: '8px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>
            🎉 Week Completed!
          </h3>
          <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
            You earned +2000 XP bonus! Start a new week for more rewards.
          </p>
        </div>
      )}

      {/* Total XP */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '12px',
        textAlign: 'center',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '4px'
        }}>
          {totalXP.toLocaleString()} XP
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6b7280'
        }}>
          Total Quest XP Earned
        </div>
      </div>
    </div>
  )
}

export default DailyQuestSystem
