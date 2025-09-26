import React, { useState, useEffect } from 'react'
import { Calendar, CheckCircle, Star, Trophy, Zap, Target, Gift, RotateCcw, MessageSquare, Coins, Dice1, Dice6, Image, Layers } from 'lucide-react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { useQuestSystem } from '../hooks/useQuestSystem'
import { useAccount } from 'wagmi'

const DailyQuestSystem = () => {
  const { address } = useAccount()
  const { questProgress, updateQuestProgress, awardQuestXP, completeQuestDay, awardWeeklyBonus, resetQuestWeek } = useQuestSystem()
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
  }, [])

  // Sync with Supabase quest progress
  useEffect(() => {
    if (questProgress) {
      setCurrentDay(questProgress.current_day || 1)
      setWeeklyBonus(questProgress.weekly_bonus_earned || false)
      setTotalXP(questProgress.total_quest_xp || 0)
    }
  }, [questProgress])

  useEffect(() => {
    checkQuestCompletion()
  }, [currentDay, quests, questProgress])

  const initializeQuests = () => {
    const questTemplates = [
      // Day 1 - Use all features 1 time
      {
        day: 1,
        title: "GM/GN Game",
        description: "Use GM or GN game 1 time",
        xpReward: 50,
        icon: <MessageSquare size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmGnUsed: 1 }
      },
      {
        day: 1,
        title: "Coin Flip Game",
        description: "Play coin flip 1 time",
        xpReward: 50,
        icon: <Coins size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 1 }
      },
      {
        day: 1,
        title: "Lucky Number Game",
        description: "Play lucky number 1 time",
        xpReward: 50,
        icon: <Dice1 size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 1 }
      },
      {
        day: 1,
        title: "Dice Roll Game",
        description: "Play dice roll 1 time",
        xpReward: 50,
        icon: <Dice6 size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 1 }
      },
      {
        day: 1,
        title: "Deploy Token",
        description: "Deploy ERC20 token 1 time",
        xpReward: 50,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 1 }
      },
      {
        day: 1,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 1 time",
        xpReward: 50,
        icon: <Image size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 1 }
      },
      {
        day: 1,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 1 time",
        xpReward: 50,
        icon: <Layers size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 1 }
      },

      // Day 2 - Use all features 2 times
      {
        day: 2,
        title: "GM/GN Game",
        description: "Use GM or GN game 2 times",
        xpReward: 50,
        icon: <MessageSquare size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmGnUsed: 2 }
      },
      {
        day: 2,
        title: "Coin Flip Game",
        description: "Play coin flip 2 times",
        xpReward: 50,
        icon: <Coins size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 2 }
      },
      {
        day: 2,
        title: "Lucky Number Game",
        description: "Play lucky number 2 times",
        xpReward: 50,
        icon: <Dice1 size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 2 }
      },
      {
        day: 2,
        title: "Dice Roll Game",
        description: "Play dice roll 2 times",
        xpReward: 50,
        icon: <Dice6 size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 2 }
      },
      {
        day: 2,
        title: "Deploy Token",
        description: "Deploy ERC20 token 2 times",
        xpReward: 50,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 2 }
      },
      {
        day: 2,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 2 times",
        xpReward: 50,
        icon: <Image size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 2 }
      },
      {
        day: 2,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 2 times",
        xpReward: 50,
        icon: <Layers size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 2 }
      },

      // Day 3 - Use all features 3 times
      {
        day: 3,
        title: "GM/GN Game",
        description: "Use GM or GN game 3 times",
        xpReward: 50,
        icon: <MessageSquare size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmGnUsed: 3 }
      },
      {
        day: 3,
        title: "Coin Flip Game",
        description: "Play coin flip 3 times",
        xpReward: 50,
        icon: <Coins size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 3 }
      },
      {
        day: 3,
        title: "Lucky Number Game",
        description: "Play lucky number 3 times",
        xpReward: 50,
        icon: <Dice1 size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 3 }
      },
      {
        day: 3,
        title: "Dice Roll Game",
        description: "Play dice roll 3 times",
        xpReward: 50,
        icon: <Dice6 size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 3 }
      },
      {
        day: 3,
        title: "Deploy Token",
        description: "Deploy ERC20 token 3 times",
        xpReward: 50,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 3 }
      },
      {
        day: 3,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 3 times",
        xpReward: 50,
        icon: <Image size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 3 }
      },
      {
        day: 3,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 3 times",
        xpReward: 50,
        icon: <Layers size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 3 }
      },

      // Day 4 - Use all features 4 times
      {
        day: 4,
        title: "GM/GN Game",
        description: "Use GM or GN game 4 times",
        xpReward: 50,
        icon: <MessageSquare size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmGnUsed: 4 }
      },
      {
        day: 4,
        title: "Coin Flip Game",
        description: "Play coin flip 4 times",
        xpReward: 50,
        icon: <Coins size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 4 }
      },
      {
        day: 4,
        title: "Lucky Number Game",
        description: "Play lucky number 4 times",
        xpReward: 50,
        icon: <Dice1 size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 4 }
      },
      {
        day: 4,
        title: "Dice Roll Game",
        description: "Play dice roll 4 times",
        xpReward: 50,
        icon: <Dice6 size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 4 }
      },
      {
        day: 4,
        title: "Deploy Token",
        description: "Deploy ERC20 token 4 times",
        xpReward: 50,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 4 }
      },
      {
        day: 4,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 4 times",
        xpReward: 50,
        icon: <Image size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 4 }
      },
      {
        day: 4,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 4 times",
        xpReward: 50,
        icon: <Layers size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 4 }
      },

      // Day 5 - Use all features 5 times
      {
        day: 5,
        title: "GM/GN Game",
        description: "Use GM or GN game 5 times",
        xpReward: 50,
        icon: <MessageSquare size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmGnUsed: 5 }
      },
      {
        day: 5,
        title: "Coin Flip Game",
        description: "Play coin flip 5 times",
        xpReward: 50,
        icon: <Coins size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 5 }
      },
      {
        day: 5,
        title: "Lucky Number Game",
        description: "Play lucky number 5 times",
        xpReward: 50,
        icon: <Dice1 size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 5 }
      },
      {
        day: 5,
        title: "Dice Roll Game",
        description: "Play dice roll 5 times",
        xpReward: 50,
        icon: <Dice6 size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 5 }
      },
      {
        day: 5,
        title: "Deploy Token",
        description: "Deploy ERC20 token 5 times",
        xpReward: 50,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 5 }
      },
      {
        day: 5,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 5 times",
        xpReward: 50,
        icon: <Image size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 5 }
      },
      {
        day: 5,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 5 times",
        xpReward: 50,
        icon: <Layers size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 5 }
      },

      // Day 6 - Use all features 6 times
      {
        day: 6,
        title: "GM/GN Game",
        description: "Use GM or GN game 6 times",
        xpReward: 50,
        icon: <MessageSquare size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmGnUsed: 6 }
      },
      {
        day: 6,
        title: "Coin Flip Game",
        description: "Play coin flip 6 times",
        xpReward: 50,
        icon: <Coins size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 6 }
      },
      {
        day: 6,
        title: "Lucky Number Game",
        description: "Play lucky number 6 times",
        xpReward: 50,
        icon: <Dice1 size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 6 }
      },
      {
        day: 6,
        title: "Dice Roll Game",
        description: "Play dice roll 6 times",
        xpReward: 50,
        icon: <Dice6 size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 6 }
      },
      {
        day: 6,
        title: "Deploy Token",
        description: "Deploy ERC20 token 6 times",
        xpReward: 50,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 6 }
      },
      {
        day: 6,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 6 times",
        xpReward: 50,
        icon: <Image size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 6 }
      },
      {
        day: 6,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 6 times",
        xpReward: 50,
        icon: <Layers size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 6 }
      },

      // Day 7 - Use all features 7 times
      {
        day: 7,
        title: "GM/GN Game",
        description: "Use GM or GN game 7 times",
        xpReward: 50,
        icon: <MessageSquare size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmGnUsed: 7 }
      },
      {
        day: 7,
        title: "Coin Flip Game",
        description: "Play coin flip 7 times",
        xpReward: 50,
        icon: <Coins size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 7 }
      },
      {
        day: 7,
        title: "Lucky Number Game",
        description: "Play lucky number 7 times",
        xpReward: 50,
        icon: <Dice1 size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 7 }
      },
      {
        day: 7,
        title: "Dice Roll Game",
        description: "Play dice roll 7 times",
        xpReward: 50,
        icon: <Dice6 size={20} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 7 }
      },
      {
        day: 7,
        title: "Deploy Token",
        description: "Deploy ERC20 token 7 times",
        xpReward: 50,
        icon: <Gift size={20} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 7 }
      },
      {
        day: 7,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 7 times",
        xpReward: 50,
        icon: <Image size={20} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 7 }
      },
      {
        day: 7,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 7 times",
        xpReward: 50,
        icon: <Layers size={20} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 7 }
      }
    ]

    setQuests(questTemplates)
  }

  // Remove old localStorage functions - now handled by useQuestSystem hook

  const checkQuestCompletion = async () => {
    if (!questProgress || !quests.length) return
    
    const questStats = questProgress.quest_stats || {}
    
    // Check current day quests
    const currentDayQuests = quests.filter(q => q.day === currentDay)
    let allCompleted = true
    
    currentDayQuests.forEach(quest => {
      const requirement = Object.keys(quest.requirements)[0]
      const required = quest.requirements[requirement]
      const current = questStats[requirement] || 0
      
      if (current < required) {
        allCompleted = false
      }
    })
    
    if (allCompleted && currentDayQuests.length > 0) {
      // Award XP for completing the day
      const dayXP = currentDayQuests.length * 50 // 50 XP per quest
      await awardQuestXP(dayXP, 'quest_completion', currentDay)
      
      // All quests for current day completed
      if (currentDay < 7) {
        await completeQuestDay(currentDay)
      } else {
        // Week completed!
        await awardWeeklyBonus()
      }
    }
  }

  const resetWeek = async () => {
    await resetQuestWeek()
  }

  const getCurrentDayQuests = () => {
    return quests.filter(q => q.day === currentDay)
  }

  const getQuestProgress = () => {
    const dayQuests = getCurrentDayQuests()
    const questStats = questProgress?.quest_stats || {}
    
    let completed = 0
    dayQuests.forEach(quest => {
      const requirement = Object.keys(quest.requirements)[0]
      const required = quest.requirements[requirement]
      const current = questStats[requirement] || 0
      
      if (current >= required) {
        completed++
      }
    })
    
    return { completed, total: dayQuests.length }
  }

  const progress = getQuestProgress()

  if (!address) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white',
        textAlign: 'center'
      }}>
        <Calendar size={32} style={{ marginBottom: '12px' }} />
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>
          7-Day Quest System
        </h3>
        <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
          Connect your wallet to start earning XP through daily quests!
        </p>
      </div>
    )
  }

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
          {getCurrentDayQuests().map((quest, index) => {
            const questStats = questProgress?.quest_stats || {}
            const requirement = Object.keys(quest.requirements)[0]
            const required = quest.requirements[requirement]
            const current = questStats[requirement] || 0
            const isCompleted = current >= required
            
            return (
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
                  opacity: isCompleted ? 0.6 : 1
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
                    {quest.description} ({current}/{required})
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
                  {isCompleted && (
                    <CheckCircle size={16} style={{ color: '#10b981', marginTop: '4px' }} />
                  )}
                </div>
              </div>
            )
          })}
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
            You earned +10,000 XP bonus! Start a new week for more rewards.
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
