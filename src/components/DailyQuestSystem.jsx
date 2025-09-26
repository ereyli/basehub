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
  const [nextDayUnlockTime, setNextDayUnlockTime] = useState(null)
  const [timeUntilNextDay, setTimeUntilNextDay] = useState(null)

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
      
      // Check if there's a next day unlock time
      if (questProgress.next_day_unlock_time) {
        setNextDayUnlockTime(new Date(questProgress.next_day_unlock_time))
      }
    }
  }, [questProgress])

  // Countdown timer for next day
  useEffect(() => {
    if (!nextDayUnlockTime) return

    const updateCountdown = () => {
      const now = new Date()
      const timeLeft = nextDayUnlockTime.getTime() - now.getTime()
      
      if (timeLeft <= 0) {
        setTimeUntilNextDay(null)
        setNextDayUnlockTime(null)
        // Check if we can unlock next day
        checkAndUnlockNextDay()
      } else {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60))
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)
        setTimeUntilNextDay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [nextDayUnlockTime])

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
      console.log(`🎉 Day ${currentDay} completed! +${dayXP} XP`)
      
      // Set 24-hour timer for next day
      if (currentDay < 7) {
        await setNextDayTimer()
      } else {
        // Week completed!
        await awardWeeklyBonus()
      }
    }
  }

  const setNextDayTimer = async () => {
    if (!address || !supabase) return

    try {
      const nextUnlockTime = new Date()
      nextUnlockTime.setHours(nextUnlockTime.getHours() + 24) // 24 hours from now

      const { error } = await supabase
        .from('quest_progress')
        .update({
          next_day_unlock_time: nextUnlockTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)

      if (error) throw error

      setNextDayUnlockTime(nextUnlockTime)
      console.log(`⏰ Next day unlocks in 24 hours: ${nextUnlockTime.toLocaleString()}`)
    } catch (err) {
      console.error('Error setting next day timer:', err)
    }
  }

  const checkAndUnlockNextDay = async () => {
    if (!address || !supabase) return

    try {
      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          current_day: currentDay + 1,
          next_day_unlock_time: null,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      setCurrentDay(currentDay + 1)
      setNextDayUnlockTime(null)
      console.log(`🎉 Day ${currentDay + 1} unlocked!`)
    } catch (err) {
      console.error('Error unlocking next day:', err)
    }
  }

  const resetWeek = async () => {
    await resetQuestWeek()
  }

  const getCurrentDayQuests = () => {
    // If there's a countdown timer, show current day quests as locked
    if (timeUntilNextDay) {
      return []
    }
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
      borderRadius: '12px',
      padding: '16px',
      margin: '16px 0',
      border: '1px solid #e2e8f0'
    }}>
      {/* Compact Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Calendar size={16} />
          </div>
          <div>
            <h3 style={{
              margin: '0',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              Daily Quests
            </h3>
            <p style={{
              margin: '0',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {timeUntilNextDay ? (
                `Next day in: ${timeUntilNextDay}`
              ) : (
                `Day ${currentDay}/7 • ${progress.completed}/${progress.total} done`
              )}
            </p>
          </div>
        </div>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#10b981'
        }}>
          {totalXP} XP
        </div>
      </div>

      {/* Compact Progress Bar */}
      <div style={{
        background: '#e5e7eb',
        borderRadius: '6px',
        height: '6px',
        marginBottom: '12px',
        overflow: 'hidden'
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
          height: '100%',
          width: `${(progress.completed / progress.total) * 100}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Compact Quest Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '8px',
        marginBottom: weeklyBonus ? '12px' : '0'
      }}>
          {timeUntilNextDay ? (
            <div style={{
              gridColumn: '1 / -1',
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                🎉 Day {currentDay} Completed!
              </div>
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '12px'
              }}>
                All quests completed. Next day unlocks in:
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#3b82f6',
                fontFamily: 'monospace'
              }}>
                {timeUntilNextDay}
              </div>
            </div>
          ) : (
            getCurrentDayQuests().map((quest, index) => {
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
                  borderRadius: '8px',
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isCompleted ? 0.6 : 1,
                  minHeight: '48px'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: quest.color,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {quest.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{
                    margin: '0 0 2px 0',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1f2937',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {quest.title}
                  </h4>
                  <p style={{
                    margin: '0',
                    fontSize: '10px',
                    color: '#6b7280'
                  }}>
                    {current}/{required}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#10b981'
                  }}>
                    +{quest.xpReward}
                  </div>
                  {isCompleted && (
                    <CheckCircle size={12} style={{ color: '#10b981' }} />
                  )}
                </div>
              </div>
            )
          }))}
        </div>

      {/* Compact Weekly Bonus */}
      {weeklyBonus && (
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'center',
          color: 'white',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Trophy size={16} />
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
              Week Complete! +10,000 XP
            </span>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: '12px'
      }}>
        <button
          onClick={resetWeek}
          style={{
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '11px',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <RotateCcw size={12} />
          Reset Week
        </button>
      </div>
    </div>
  )
}

export default DailyQuestSystem
