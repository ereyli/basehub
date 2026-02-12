// Hook for Featured Profiles and Follow System
import { useState } from 'react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useWalletClient, useChainId, useSwitchChain } from 'wagmi'
import { wrapFetchWithPayment } from 'x402-fetch'
import { NETWORKS } from '../config/networks'

export const useFeaturedProfiles = () => {
  const { user } = useFarcaster()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
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

      // x402 payments only work on Base network - switch if needed
      if (chainId !== NETWORKS.BASE.chainId) {
        try {
          await switchChain({ chainId: NETWORKS.BASE.chainId })
          // Wait a bit for network switch
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (err) {
          throw new Error('Please switch to Base network to use x402 payments')
        }
      }

      // Pricing map - Only daily available
      const pricing = {
        daily: { amount: '0.2', maxPayment: BigInt(200000) } // 0.2 USDC = 200000 (6 decimals)
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

      // Single endpoint for daily subscription only
      const endpoint = `/api/x402-featured-profile`
      console.log('🔐 Initiating x402 payment for:', { endpoint, subscriptionType, maxPayment: selectedPricing.maxPayment })
      
      const response = await fetchWithPayment(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // subscription_type is now in the route path, not in body
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
        // Clone response before reading to avoid "body stream already read" error
        const clonedResponse = response.clone()
        let errorData = {}
        try {
          errorData = await clonedResponse.json()
        } catch (e) {
          try {
            const textData = await response.text()
            errorData = { error: textData }
          } catch (textError) {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
          }
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
  const checkFollowStatus = async (followingFid, userFidOverride = null) => {
    try {
      // Use override if provided, otherwise use user?.fid
      const currentUserFid = userFidOverride || user?.fid
      
      if (!currentUserFid) {
        return { is_following: false }
      }

      // Use query params instead of path params to avoid 404 on nested routes
      const url = `/api/follow?action=check&follower_fid=${currentUserFid}&following_fid=${followingFid}`
      const response = await fetch(url)
      
      // Check if response is ok
      if (!response.ok) {
        // Only log 404 errors (real problem)
        if (response.status === 404) {
          console.error(`❌ Follow API endpoint not found: ${url}`)
        }
        return { is_following: false }
      }
      
      // Check content type
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        return { is_following: false }
      }
      
      const data = await response.json()
      
      if (!data.success) {
        return { is_following: false }
      }

      return {
        is_following: data.is_following || false,
        // is_mutual removed - not reliable without Farcaster API
      }
    } catch (err) {
      // Only log network errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        console.error('❌ Network error checking follow status:', err.message)
      }
      return { is_following: false }
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

  // Update profile description (no payment required)
  const updateProfileDescription = async (fid, description) => {
    setIsLoading(true)
    setError(null)

    try {
      // Use query params instead of path params to avoid Vercel routing issues
      const response = await fetch(`/api/featured-profiles?fid=${fid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to update profile')
      }

      return data.profile
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    registerProfile,
    getFeaturedProfiles,
    updateProfileDescription,
    followUser,
    unfollowUser,
    checkFollowStatus,
    getFollowers,
    getFollowing,
    isLoading,
    error,
  }
}

