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
  const [sharedCast, setSharedCast] = useState(null)
  const [isShareContext, setIsShareContext] = useState(false)
  
  // Check if we're actually in Farcaster environment
  const [isInFarcaster, setIsInFarcaster] = useState(() => {
    if (typeof window === 'undefined') return false
    
    // Check if we're in Farcaster Mini App environment
    const isInFarcasterEnv = window.location !== window.parent.location || 
                            window.parent !== window ||
                            window.location.href.includes('farcaster.xyz') ||
                            window.location.href.includes('warpcast.com') ||
                            window.location.href.includes('basehub-alpha.vercel.app')
    
    console.log('🔍 Farcaster Context Environment Check:', { isInFarcasterEnv })
    return isInFarcasterEnv
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

  // Check user context once after initialization (no polling)
  useEffect(() => {
    if (!isInFarcaster || !isInitialized || user) return

    // Check once if user is already available
    try {
      if (sdk?.context?.user && sdk.context.user.fid) {
        console.log('✅ User found in context:', sdk.context.user)
        setUser(sdk.context.user)
      }
    } catch (err) {
      // Ignore errors
    }
  }, [isInFarcaster, isInitialized, user, sdk])

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
        // According to Farcaster SDK docs: sdk.context.user (not getUser())
        // User is available immediately after ready() call
        try {
          if (sdk.context && sdk.context.user) {
            const userContext = sdk.context.user
            console.log('✅ User context loaded:', userContext)
            setUser(userContext)
          } else {
            console.log('⚠️ User context not available in sdk.context')
            // Single retry after a short delay
            setTimeout(() => {
              if (sdk.context?.user) {
                console.log('✅ User context loaded on retry:', sdk.context.user)
                setUser(sdk.context.user)
              }
            }, 1000)
          }
        } catch (userError) {
          console.error('❌ Error accessing user context:', userError)
        }

        // Check if we're in a cast share context
        try {
          if (sdk.context.location && sdk.context.location.type === 'cast_share') {
            console.log('📤 Cast share context detected:', sdk.context.location.cast)
            setIsShareContext(true)
            setSharedCast(sdk.context.location.cast)
          }
        } catch (shareError) {
          console.log('ℹ️ No cast share context:', shareError.message)
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
    sharedCast,
    isShareContext,
  }

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  )
}