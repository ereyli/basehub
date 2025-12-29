// Hook for Featured Profiles and Follow System
import { useState } from 'react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useWalletClient } from 'wagmi'
import { wrapFetchWithPayment } from 'x402-fetch'

export const useFeaturedProfiles = () => {
  const { user } = useFarcaster()
  const { data: walletClient } = useWalletClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Register profile with x402 payment
  const registerProfile = async (profileData, subscriptionType = 'daily') => {
    setIsLoading(true)
    setError(null)

    try {
      if (!walletClient) {
        throw new Error('Wallet not connected')
      }

      if (!user?.fid) {
        throw new Error('Farcaster user not found')
      }

      // Pricing map
      const pricing = {
        daily: { amount: '0.2', maxPayment: BigInt(200000) }, // 0.2 USDC = 200000 (6 decimals)
        weekly: { amount: '1.0', maxPayment: BigInt(1000000) }, // 1.0 USDC
        monthly: { amount: '6.0', maxPayment: BigInt(6000000) } // 6.0 USDC
      }

      const selectedPricing = pricing[subscriptionType]
      if (!selectedPricing) {
        throw new Error('Invalid subscription type')
      }

      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        walletClient,
        selectedPricing.maxPayment
      )

      // Call appropriate endpoint based on subscription type
      const endpoint = `/api/x402-featured-profile/${subscriptionType}`
      console.log('🔐 Initiating x402 payment for:', { endpoint, subscriptionType, maxPayment: selectedPricing.maxPayment })
      
      const response = await fetchWithPayment(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          farcaster_fid: user.fid,
          username: user.username,
          display_name: user.displayName,
          avatar_url: user.pfpUrl, // Farcaster SDK: pfpUrl (not pfp.url)
          bio: user.bio, // Farcaster SDK: bio (not bio.text)
          description: profileData.description, // Kullanıcının yazdığı açıklama
          wallet_address: user.walletAddress || profileData.walletAddress,
        }),
      })

      if (!response.ok) {
        let errorData = {}
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { error: await response.text() }
        }

        if (response.status === 402) {
          throw new Error('Payment required. Please complete the payment in your wallet.')
        }

        throw new Error(errorData.error || errorData.message || 'Registration failed')
      }

      const result = await response.json()
      console.log('✅ Profile registered successfully:', result)
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  // Get featured profiles list
  const getFeaturedProfiles = async () => {
    try {
      const response = await fetch('/api/featured-profiles')
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      // Check content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Expected JSON but got: ${contentType}. Response: ${text.substring(0, 100)}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch profiles')
      }

      return data.profiles || []
    } catch (err) {
      console.error('Error fetching featured profiles:', err)
      setError(err.message)
      return []
    }
  }

  // Follow a user
  const followUser = async (followingFid) => {
    try {
      if (!user?.fid) {
        throw new Error('Farcaster user not found')
      }

      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          follower_fid: user.fid,
          following_fid: followingFid,
        }),
      })

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to follow user')
      }

      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Unfollow a user
  const unfollowUser = async (followingFid) => {
    try {
      if (!user?.fid) {
        throw new Error('Farcaster user not found')
      }

      const response = await fetch('/api/follow', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          follower_fid: user.fid,
          following_fid: followingFid,
        }),
      })

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to unfollow user')
      }

      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Check if following a user
  const checkFollowStatus = async (followingFid) => {
    try {
      if (!user?.fid) {
        return { is_following: false, is_mutual: false }
      }

      const response = await fetch(`/api/follow/check/${user.fid}/${followingFid}`)
      const data = await response.json()
      
      if (!data.success) {
        return { is_following: false, is_mutual: false }
      }

      return {
        is_following: data.is_following || false,
        is_mutual: data.is_mutual || false
      }
    } catch (err) {
      console.error('Error checking follow status:', err)
      return { is_following: false, is_mutual: false }
    }
  }

  // Get followers
  const getFollowers = async (fid) => {
    try {
      const response = await fetch(`/api/follow/followers/${fid}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch followers')
      }

      return data.followers || []
    } catch (err) {
      setError(err.message)
      return []
    }
  }

  // Get following
  const getFollowing = async (fid) => {
    try {
      const response = await fetch(`/api/follow/following/${fid}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch following')
      }

      return data.following || []
    } catch (err) {
      setError(err.message)
      return []
    }
  }

  return {
    registerProfile,
    getFeaturedProfiles,
    followUser,
    unfollowUser,
    checkFollowStatus,
    getFollowers,
    getFollowing,
    isLoading,
    error,
  }
}

