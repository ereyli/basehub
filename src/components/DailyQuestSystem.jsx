import React, { useState, useEffect } from 'react'
import { Calendar, CheckCircle, Star, Trophy, Zap, Target, Gift, MessageSquare, Coins, Dice1, Dice6, Image, Layers, DollarSign } from 'lucide-react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { useQuestSystem } from '../hooks/useQuestSystem'
import { useSupabase } from '../hooks/useSupabase'
import { useAccount } from 'wagmi'

const DailyQuestSystem = () => {
  const { address } = useAccount()
  const { questProgress, updateQuestProgress, awardQuestXP, completeQuestDay, awardWeeklyBonus } = useQuestSystem()
  const { supabase } = useSupabase()
  
  // Debug logging
  console.log('🔍 DailyQuestSystem render:', { 
    address: !!address, 
    supabase: !!supabase, 
    questProgress: !!questProgress,
    currentDay: questProgress?.current_day,
    questStats: questProgress?.quest_stats
  })
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
    console.log('🔄 DailyQuestSystem questProgress useEffect triggered:', questProgress)
    if (questProgress) {
      console.log('✅ Quest progress received, updating state:', questProgress)
      setCurrentDay(questProgress.current_day || 1)
      setWeeklyBonus(questProgress.weekly_bonus_earned || false)
      setTotalXP(questProgress.total_quest_xp || 0)
      
      // Only set timer if not already set (avoid overriding direct Supabase load)
      if (questProgress.next_day_unlock_time && !nextDayUnlockTime) {
        const unlockTime = new Date(questProgress.next_day_unlock_time)
        console.log('⏰ Setting next day unlock time from questProgress:', unlockTime.toISOString())
        setNextDayUnlockTime(unlockTime)
      } else if (!questProgress.next_day_unlock_time) {
        console.log('❌ No next day unlock time in questProgress')
        setNextDayUnlockTime(null)
      }
    } else {
      console.log('❌ No quest progress available')
    }
  }, [questProgress, nextDayUnlockTime])

  // Load timer directly from Supabase on component mount (only if no timer exists)
  useEffect(() => {
    const loadTimerFromSupabase = async () => {
      if (!address || !supabase || nextDayUnlockTime) {
        console.log('⏰ Timer already exists or missing dependencies, skipping direct load')
        return
      }

      try {
        console.log('🔄 Loading timer directly from Supabase...')
        const { data, error } = await supabase
          .from('quest_progress')
          .select('next_day_unlock_time, current_day')
          .eq('wallet_address', address)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('❌ Error loading timer from Supabase:', error)
          return
        }

        if (data && data.next_day_unlock_time) {
          const unlockTime = new Date(data.next_day_unlock_time)
          const now = new Date()
          
          console.log('⏰ Timer from Supabase:', unlockTime.toISOString())
          console.log('⏰ Current time:', now.toISOString())
          console.log('⏰ Time difference (ms):', unlockTime.getTime() - now.getTime())
          
          if (unlockTime > now) {
            console.log('✅ Timer is valid, setting countdown')
            setNextDayUnlockTime(unlockTime)
          } else {
            console.log('⏰ Timer expired, unlocking next day')
            await checkAndUnlockNextDay()
          }
        } else {
          console.log('❌ No timer found in Supabase')
        }
      } catch (err) {
        console.error('❌ Error loading timer from Supabase:', err)
      }
    }

    loadTimerFromSupabase()
  }, [address, supabase, nextDayUnlockTime])

  // Countdown timer for next day
  useEffect(() => {
    if (!nextDayUnlockTime) return

    const updateCountdown = () => {
      const now = new Date()
      const timeLeft = nextDayUnlockTime.getTime() - now.getTime()
      
      if (timeLeft <= 0) {
        console.log('⏰ Timer expired, unlocking next day')
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
    if (questProgress && quests.length > 0) {
      checkQuestCompletion()
    }
  }, [currentDay, quests, questProgress])

  const initializeQuests = () => {
    const questTemplates = [
      // Day 1 - Use all features 1 time
      {
        day: 1,
        title: "GM Game",
        description: "Use GM game 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmUsed: 1 }
      },
      {
        day: 1,
        title: "GN Game",
        description: "Use GN game 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GN.png" alt="GN Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { gnUsed: 1 }
      },
      {
        day: 1,
        title: "Coin Flip Game",
        description: "Play coin flip 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 1 }
      },
      {
        day: 1,
        title: "Lucky Number Game",
        description: "Play lucky number 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 1 }
      },
      {
        day: 1,
        title: "Dice Roll Game",
        description: "Play dice roll 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 1 }
      },
      {
        day: 1,
        title: "Deploy Token",
        description: "Deploy ERC20 token 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 1 }
      },
      {
        day: 1,
        title: "AI NFT Launchpad",
        description: "Mint AI NFT 1 time",
        xpReward: 100,
        icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
        requirements: { nftMinted: 1 }
      },
      {
        day: 1,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-721.png" alt="Deploy ERC721" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 1 }
      },
      {
        day: 1,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 1 time",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 1 }
      },
      {
        day: 1,
        title: "x402 Payment",
        description: "Complete x402 payment 1 time",
        xpReward: 500,
        icon: <DollarSign size={20} style={{ color: '#10b981' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { x402Payment: 1 }
      },

      // Day 2 - Use all features 2 times
      {
        day: 2,
        title: "GM Game",
        description: "Use GM game 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmUsed: 2 }
      },
      {
        day: 2,
        title: "GN Game",
        description: "Use GN game 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { gnUsed: 2 }
      },
      {
        day: 2,
        title: "Coin Flip Game",
        description: "Play coin flip 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 2 }
      },
      {
        day: 2,
        title: "Lucky Number Game",
        description: "Play lucky number 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 2 }
      },
      {
        day: 2,
        title: "Dice Roll Game",
        description: "Play dice roll 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 2 }
      },
      {
        day: 2,
        title: "Deploy Token",
        description: "Deploy ERC20 token 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 2 }
      },
      {
        day: 2,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 2 }
      },
      {
        day: 2,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 2 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 2 }
      },
      {
        day: 2,
        title: "x402 Payment",
        description: "Complete x402 payment 2 times",
        xpReward: 500,
        icon: <DollarSign size={20} style={{ color: '#10b981' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { x402Payment: 2 }
      },

      // Day 3 - Use all features 3 times
      {
        day: 3,
        title: "GM Game",
        description: "Use GM game 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmUsed: 3 }
      },
      {
        day: 3,
        title: "GN Game",
        description: "Use GN game 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { gnUsed: 3 }
      },
      {
        day: 3,
        title: "Coin Flip Game",
        description: "Play coin flip 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 3 }
      },
      {
        day: 3,
        title: "Lucky Number Game",
        description: "Play lucky number 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 3 }
      },
      {
        day: 3,
        title: "Dice Roll Game",
        description: "Play dice roll 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 3 }
      },
      {
        day: 3,
        title: "Deploy Token",
        description: "Deploy ERC20 token 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 3 }
      },
      {
        day: 3,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 3 }
      },
      {
        day: 3,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 3 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 3 }
      },
      {
        day: 3,
        title: "x402 Payment",
        description: "Complete x402 payment 3 times",
        xpReward: 500,
        icon: <DollarSign size={20} style={{ color: '#10b981' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { x402Payment: 3 }
      },

      // Day 4 - Use all features 4 times
      {
        day: 4,
        title: "GM Game",
        description: "Use GM game 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmUsed: 4 }
      },
      {
        day: 4,
        title: "GN Game",
        description: "Use GN game 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { gnUsed: 4 }
      },
      {
        day: 4,
        title: "Coin Flip Game",
        description: "Play coin flip 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 4 }
      },
      {
        day: 4,
        title: "Lucky Number Game",
        description: "Play lucky number 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 4 }
      },
      {
        day: 4,
        title: "Dice Roll Game",
        description: "Play dice roll 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 4 }
      },
      {
        day: 4,
        title: "Deploy Token",
        description: "Deploy ERC20 token 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 4 }
      },
      {
        day: 4,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 4 }
      },
      {
        day: 4,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 4 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 4 }
      },
      {
        day: 4,
        title: "x402 Payment",
        description: "Complete x402 payment 4 times",
        xpReward: 500,
        icon: <DollarSign size={20} style={{ color: '#10b981' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { x402Payment: 4 }
      },

      // Day 5 - Use all features 5 times
      {
        day: 5,
        title: "GM Game",
        description: "Use GM game 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmUsed: 5 }
      },
      {
        day: 5,
        title: "GN Game",
        description: "Use GN game 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { gnUsed: 5 }
      },
      {
        day: 5,
        title: "Coin Flip Game",
        description: "Play coin flip 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 5 }
      },
      {
        day: 5,
        title: "Lucky Number Game",
        description: "Play lucky number 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 5 }
      },
      {
        day: 5,
        title: "Dice Roll Game",
        description: "Play dice roll 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 5 }
      },
      {
        day: 5,
        title: "Deploy Token",
        description: "Deploy ERC20 token 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 5 }
      },
      {
        day: 5,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 5 }
      },
      {
        day: 5,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 5 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 5 }
      },
      {
        day: 5,
        title: "x402 Payment",
        description: "Complete x402 payment 5 times",
        xpReward: 500,
        icon: <DollarSign size={20} style={{ color: '#10b981' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { x402Payment: 5 }
      },

      // Day 6 - Use all features 6 times
      {
        day: 6,
        title: "GM Game",
        description: "Use GM game 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmUsed: 6 }
      },
      {
        day: 6,
        title: "GN Game",
        description: "Use GN game 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { gnUsed: 6 }
      },
      {
        day: 6,
        title: "Coin Flip Game",
        description: "Play coin flip 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 6 }
      },
      {
        day: 6,
        title: "Lucky Number Game",
        description: "Play lucky number 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 6 }
      },
      {
        day: 6,
        title: "Dice Roll Game",
        description: "Play dice roll 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 6 }
      },
      {
        day: 6,
        title: "Deploy Token",
        description: "Deploy ERC20 token 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 6 }
      },
      {
        day: 6,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 6 }
      },
      {
        day: 6,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 6 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 6 }
      },
      {
        day: 6,
        title: "x402 Payment",
        description: "Complete x402 payment 6 times",
        xpReward: 500,
        icon: <DollarSign size={20} style={{ color: '#10b981' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { x402Payment: 6 }
      },

      // Day 7 - Use all features 7 times
      {
        day: 7,
        title: "GM Game",
        description: "Use GM game 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { gmUsed: 7 }
      },
      {
        day: 7,
        title: "GN Game",
        description: "Use GN game 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/GM.png" alt="GM Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { gnUsed: 7 }
      },
      {
        day: 7,
        title: "Coin Flip Game",
        description: "Play coin flip 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/CoinFlip.png" alt="Coin Flip Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { coinFlipUsed: 7 }
      },
      {
        day: 7,
        title: "Lucky Number Game",
        description: "Play lucky number 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/luckynumber.png" alt="Lucky Number Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { luckyNumberUsed: 7 }
      },
      {
        day: 7,
        title: "Dice Roll Game",
        description: "Play dice roll 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/DiceRoll.png" alt="Dice Roll Game" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        requirements: { diceRollUsed: 7 }
      },
      {
        day: 7,
        title: "Deploy Token",
        description: "Deploy ERC20 token 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { tokenDeployed: 7 }
      },
      {
        day: 7,
        title: "Deploy ERC721",
        description: "Deploy ERC721 NFT 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/AINFTLAUNCHPAD.png" alt="AI NFT Launchpad" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        requirements: { erc721Deployed: 7 }
      },
      {
        day: 7,
        title: "Deploy ERC1155",
        description: "Deploy ERC1155 contract 7 times",
        xpReward: 50,
        icon: <img src="/crypto-logos/basahub logo/ERC-1155.png" alt="Deploy ERC1155" loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />,
        color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        requirements: { erc1155Deployed: 7 }
      },
      {
        day: 7,
        title: "x402 Payment",
        description: "Complete x402 payment 7 times",
        xpReward: 500,
        icon: <DollarSign size={20} style={{ color: '#10b981' }} />,
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        requirements: { x402Payment: 7 }
      }
    ]

    setQuests(questTemplates)
  }

  // Remove old localStorage functions - now handled by useQuestSystem hook

  const checkQuestCompletion = async () => {
    if (!questProgress || !quests.length) {
      console.log('❌ Quest completion check skipped: missing questProgress or quests')
      return
    }
    
    console.log('🔍 Checking quest completion...')
    const questStats = questProgress.quest_stats || {}
    console.log('📊 Current quest stats:', questStats)
    console.log('🔍 GM quest stats:', { gmUsed: questStats.gmUsed, gnUsed: questStats.gnUsed })
    
    // Check current day quests
    const currentDayQuests = quests.filter(q => q.day === currentDay)
    console.log(`📅 Current day ${currentDay} quests:`, currentDayQuests.length)
    
    let allCompleted = true
    let completedQuestsCount = 0
    
    for (const quest of currentDayQuests) {
      const requirement = Object.keys(quest.requirements)[0]
      const required = quest.requirements[requirement]
      const current = questStats[requirement] || 0
      
      console.log(`🎯 Quest: ${quest.title} - ${current}/${required}`)
      
      // Award XP for individual quest completion
      if (current >= required && !questProgress.completed_quests?.includes(`${currentDay}-${quest.title}`)) {
        console.log(`🎁 Quest completed! Awarding ${quest.xpReward} XP for: ${quest.title}`)
        await awardQuestXP(quest.xpReward, 'quest_completion', currentDay, quest.title)
        
        // Mark quest as completed in Supabase and update local state
        const updatedQuestProgress = await markQuestAsCompleted(currentDay, quest.title)
        if (updatedQuestProgress) {
          // Update local state immediately to prevent duplicate XP awards
          setQuestProgress(prev => ({
            ...prev,
            completed_quests: [...(prev.completed_quests || []), `${currentDay}-${quest.title}`]
          }))
        }
        completedQuestsCount++
      }
      
      if (current < required) {
        allCompleted = false
      }
    }
    
    console.log(`✅ All quests completed: ${allCompleted}`)
    console.log(`📊 Completed quests: ${completedQuestsCount}/${currentDayQuests.length}`)
    
    // Only trigger day completion if ALL quests are actually completed
    if (allCompleted && currentDayQuests.length > 0 && completedQuestsCount === currentDayQuests.length) {
      console.log(`🎉 Day ${currentDay} completed! All quests done.`)
      
      // Check if timer is already set in questProgress to avoid resetting
      const hasExistingTimer = questProgress?.next_day_unlock_time
      if (!hasExistingTimer) {
        console.log('⏰ No existing timer found, setting new timer')
        // Set 24-hour timer for next day
        if (currentDay < 7) {
          await setNextDayTimer()
        } else {
          // Week completed!
          await awardWeeklyBonus()
        }
      } else {
        console.log('⏰ Timer already exists in database, skipping timer creation')
      }
    } else {
      console.log(`⏳ Day ${currentDay} not completed yet. Progress: ${completedQuestsCount}/${currentDayQuests.length}`)
    }
  }

  const setNextDayTimer = async () => {
    if (!address || !supabase) return

    try {
      // Double check if timer already exists in database
      const { data: existingData, error: checkError } = await supabase
        .from('quest_progress')
        .select('next_day_unlock_time')
        .eq('wallet_address', address)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing timer:', checkError)
        return
      }

      if (existingData?.next_day_unlock_time) {
        console.log('⏰ Timer already exists in database, skipping timer creation')
        return
      }

      const nextUnlockTime = new Date()
      nextUnlockTime.setHours(nextUnlockTime.getHours() + 24) // 24 hours from now

      console.log(`⏰ Setting 24-hour timer: ${nextUnlockTime.toISOString()}`)

      const { error } = await supabase
        .from('quest_progress')
        .update({
          next_day_unlock_time: nextUnlockTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)

      if (error) throw error

      setNextDayUnlockTime(nextUnlockTime)
      console.log(`✅ Timer set in Supabase: ${nextUnlockTime.toLocaleString()}`)
    } catch (err) {
      console.error('Error setting next day timer:', err)
    }
  }

  const checkAndUnlockNextDay = async () => {
    if (!address || !supabase) return

    try {
      console.log(`🔄 Unlocking next day for address: ${address}`)
      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          current_day: currentDay + 1,
          next_day_unlock_time: null,
          // Reset quest stats for new day - this is the key fix!
          quest_stats: {},
          completed_quests: [],
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      setCurrentDay(currentDay + 1)
      setNextDayUnlockTime(null)
      setTimeUntilNextDay(null)
      
      console.log(`🎉 Day ${currentDay + 1} unlocked! Quest stats reset for new day.`)
    } catch (err) {
      console.error('Error unlocking next day:', err)
    }
  }

  const markQuestAsCompleted = async (day, questTitle) => {
    if (!address || !supabase) return

    try {
      const questId = `${day}-${questTitle}`
      const currentCompletedQuests = questProgress.completed_quests || []
      
      if (currentCompletedQuests.includes(questId)) {
        console.log(`Quest ${questId} already marked as completed`)
        return questProgress
      }

      const newCompletedQuests = [...currentCompletedQuests, questId]

      const { data, error } = await supabase
        .from('quest_progress')
        .update({
          completed_quests: newCompletedQuests,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', address)
        .select()
        .single()

      if (error) throw error

      console.log(`✅ Quest ${questId} marked as completed in Supabase`)
      return data
    } catch (err) {
      console.error('Error marking quest as completed:', err)
      return null
    }
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

    </div>
  )
}

export default DailyQuestSystem
