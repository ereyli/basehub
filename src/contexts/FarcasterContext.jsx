import React, { createContext, useContext, useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

const FarcasterContext = createContext()

export const useFarcaster = () => {
  const context = useContext(FarcasterContext)
  if (!context) {
    throw new Error('useFarcaster must be used within a FarcasterProvider')
  }
  return context
}

export const FarcasterProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  
  // Check if we're actually in Farcaster environment
  const [isInFarcaster, setIsInFarcaster] = useState(() => {
    // Check if we're in Farcaster Mini App environment
    return typeof window !== 'undefined' && 
           (window.location !== window.parent.location || 
            window.parent !== window ||
            window.location.href.includes('farcaster.xyz') ||
            window.location.href.includes('warpcast.com'))
  })

  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        console.log('🚀 Initializing Farcaster Mini App...')
        
        // Check if we're actually in Farcaster environment
        const actuallyInFarcaster = typeof window !== 'undefined' && 
          (window.location !== window.parent.location || 
           window.parent !== window ||
           window.location.href.includes('farcaster.xyz') ||
           window.location.href.includes('warpcast.com') ||
           window.location.href.includes('basehub-alpha.vercel.app'))
        
        setIsInFarcaster(actuallyInFarcaster)
        console.log('🔍 Farcaster environment check:', actuallyInFarcaster)
        
        // Wait a bit for SDK to load properly
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Mark as initialized
        setIsInitialized(true)
        console.log('✅ Farcaster context initialized')
        
      } catch (err) {
        console.error('❌ Failed to initialize Farcaster:', err)
        setError(err.message)
        setIsInitialized(true) // Still set to true to allow app to continue
      }
    }

    initializeFarcaster()
  }, [])

  // Handle ready() call when DOM is fully loaded
  useEffect(() => {
    if (!isInitialized || isReady) return

    const handleReady = async () => {
      try {
        console.log('⏳ Waiting for DOM to be fully ready...')
        
        // Only call ready() if we're actually in Farcaster
        if (!isInFarcaster) {
          console.log('ℹ️ Not in Farcaster environment, skipping ready() call')
          setIsReady(true)
          return
        }
        
        // Wait for complete DOM load
        if (document.readyState !== 'complete') {
          await new Promise(resolve => {
            const handleLoad = () => {
              console.log('📋 DOM loaded completely')
              resolve()
            }
            if (document.readyState === 'complete') {
              handleLoad()
            } else {
              window.addEventListener('load', handleLoad, { once: true })
            }
          })
        }

        // Wait for React hydration and SDK to be ready
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Check if SDK is available before calling ready
        if (typeof sdk === 'undefined' || !sdk.actions) {
          console.log('⚠️ SDK not available, setting ready anyway')
          setIsReady(true)
          return
        }
        
        console.log('📞 Calling sdk.actions.ready()...')
        await sdk.actions.ready()
        
        setIsReady(true)
        console.log('✅ Farcaster Mini App is ready!')
        
        // Try to get user context after ready
        try {
          const userContext = await sdk.context.getUser()
          setUser(userContext)
          console.log('✅ User context loaded:', userContext)
        } catch (userError) {
          console.log('ℹ️ User context not available:', userError.message)
        }
        
      } catch (err) {
        console.error('❌ Failed to call ready():', err)
        setIsReady(true) // Set anyway to prevent infinite loading
      }
    }

    // Start the ready process
    handleReady()
  }, [isInitialized, isReady, isInFarcaster])

  const sendTransaction = async (transaction) => {
    if (!isInFarcaster) {
      throw new Error('Transaction can only be sent from within Farcaster')
    }
    try {
      console.log('💸 Sending transaction via Farcaster SDK:', transaction)
      const result = await sdk.actions.sendTransaction(transaction)
      console.log('✅ Transaction sent successfully:', result)
      return result
    } catch (err) {
      console.error('❌ Transaction failed:', err)
      throw err
    }
  }

  const sendNotification = async (notification) => {
    if (!isInFarcaster) {
      console.log('ℹ️ Notifications only work within Farcaster')
      return
    }
    try {
      console.log('🔔 Sending notification:', notification)
      await sdk.actions.sendNotification(notification)
      console.log('✅ Notification sent successfully')
    } catch (err) {
      console.error('❌ Failed to send notification:', err)
    }
  }

  const value = {
    isInitialized,
    isReady,
    user,
    isInFarcaster,
    error,
    sendTransaction,
    sendNotification,
    sdk,
  }

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  )
}