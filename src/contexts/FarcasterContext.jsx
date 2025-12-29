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

    // Check once if user is already available - sdk.context is a Promise
    const checkUser = async () => {
      try {
        const context = await sdk.context
        if (context?.user && context.user.fid) {
          console.log('✅ User found in context:', context.user)
          setUser(context.user)
        }
      } catch (err) {
        console.error('❌ Error checking user:', err)
      }
    }
    
    checkUser()
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
        
        // Wait for complete DOM load (with timeout)
        if (document.readyState !== 'complete') {
          await Promise.race([
            new Promise(resolve => {
              const handleLoad = () => {
                console.log('📋 DOM loaded completely')
                resolve()
              }
              if (document.readyState === 'complete') {
                handleLoad()
              } else {
                window.addEventListener('load', handleLoad, { once: true })
              }
            }),
            new Promise(resolve => setTimeout(resolve, 3000)) // 3 second timeout
          ])
        }

        // Wait for React hydration and SDK to be ready (reduced from 2000ms to 500ms)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Check if SDK is available before calling ready
        if (typeof sdk === 'undefined' || !sdk.actions) {
          console.log('⚠️ SDK not available, setting ready anyway')
          setIsReady(true)
          return
        }
        
        console.log('📞 Calling sdk.actions.ready()...')
        // Add timeout to ready() call - don't wait forever
        const readyPromise = sdk.actions.ready()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('ready() timeout')), 5000)
        )
        
        try {
          await Promise.race([readyPromise, timeoutPromise])
          console.log('✅ sdk.actions.ready() completed')
        } catch (readyError) {
          console.warn('⚠️ ready() call failed or timed out:', readyError.message)
          // Continue anyway - don't block the app
        }
        
        setIsReady(true)
        console.log('✅ Farcaster Mini App is ready!')
        
        // Try to get user context after ready
        // sdk.context is a Promise, must await it
        try {
          const context = await sdk.context
          if (context && context.user) {
            console.log('✅ User context loaded:', context.user)
            setUser(context.user)
          } else {
            console.log('⚠️ User context not available')
            // Single retry after a short delay
            setTimeout(async () => {
              try {
                const retryContext = await sdk.context
                if (retryContext?.user) {
                  console.log('✅ User context loaded on retry:', retryContext.user)
                  setUser(retryContext.user)
                }
              } catch (retryError) {
                console.error('❌ Retry failed:', retryError)
              }
            }, 1000)
          }
        } catch (userError) {
          console.error('❌ Error accessing user context:', userError)
        }

        // Check if we're in a cast share context
        try {
          const context = await sdk.context
          if (context.location && context.location.type === 'cast_share') {
            console.log('📤 Cast share context detected:', context.location.cast)
            setIsShareContext(true)
            setSharedCast(context.location.cast)
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