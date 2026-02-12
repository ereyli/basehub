import { useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { getAddChainParams } from '../config/networks'

function isChainNotAddedError(err) {
  if (!err) return false
  const code = err.code ?? err.cause?.code ?? err.error?.code
  const msg = (err.message || err.cause?.message || err.error?.message || '').toLowerCase()
  if (Number(code) === 4902 || String(code) === '4902') return true
  return msg.includes('not been added') || msg.includes('unrecognized chain') || msg.includes('unknown chain')
}

/**
 * Component that intercepts RainbowKit's chain switching and automatically adds networks
 * when they're not present in the wallet. This ensures seamless network switching
 * when users select networks from RainbowKit's ConnectButton modal.
 */
export const RainbowKitChainInterceptor = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchToNetwork } = useNetworkCheck()
  const isWeb = shouldUseRainbowKit()

  // Detect mobile browsers
  const isMobile = typeof window !== 'undefined' && 
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator?.userAgent || '') ||
     (window.navigator?.maxTouchPoints && window.navigator.maxTouchPoints > 2))

  // Only run on desktop web, not in Farcaster or mobile browsers
  if (!isWeb || isMobile) {
    if (isMobile) {
      console.warn('⚠️ RainbowKitChainInterceptor disabled for mobile browsers to prevent crashes.')
    }
    return null
  }

  useEffect(() => {
    if (!isConnected || typeof window.ethereum === 'undefined') {
      return
    }

    // Listen for chain changes from RainbowKit's ConnectButton
    const handleChainChanged = async (newChainIdHex) => {
      try {
        const newChainId = parseInt(newChainIdHex, 16)
        console.log('🔄 Chain changed detected:', newChainId)
        
        // Get current chain ID from wallet
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
        const currentChainIdDecimal = parseInt(currentChainId, 16)
        
        // If already on the target chain, no need to switch
        if (currentChainIdDecimal === newChainId) {
          console.log('✅ Already on target chain')
          return
        }
        
        // Try to switch using our switchToNetwork which handles auto-add
        await switchToNetwork(newChainId)
        console.log('✅ Successfully switched to chain:', newChainId)
      } catch (error) {
        console.error('❌ Failed to handle chain change:', error)
        // Don't throw - let RainbowKit handle the error
      }
    }

    // Listen for chain changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', handleChainChanged)
      
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('chainChanged', handleChainChanged)
        }
      }
    }
  }, [isConnected, chainId, switchToNetwork, isWeb])

  // Also intercept wagmi's switchChain calls - Safely wrapped
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
      return
    }

    try {
      // Store original request method safely
      if (!window.ethereum.request) {
        return
      }

      const originalRequest = window.ethereum.request.bind(window.ethereum)
      let isIntercepting = false

      window.ethereum.request = async function(...args) {
        try {
          // Only intercept wallet_switchEthereumChain calls
          if (args[0]?.method === 'wallet_switchEthereumChain' && !isIntercepting) {
            try {
              return await originalRequest(...args)
            } catch (error) {
              // If chain not added (4902), add it here directly to avoid re-entering switchToNetwork
              if (isChainNotAddedError(error)) {
                const chainIdHex = args[0]?.params?.[0]?.chainId
                if (chainIdHex) {
                  const targetChainId = parseInt(chainIdHex, 16)
                  const addParams = getAddChainParams(targetChainId)
                  if (addParams) {
                    console.log('🔄 Auto-adding network:', targetChainId)
                    isIntercepting = true
                    try {
                      const payload = JSON.parse(JSON.stringify(addParams))
                      await originalRequest({
                        method: 'wallet_addEthereumChain',
                        params: [payload],
                      })
                      console.log('✅ Network added, switching...')
                      const result = await originalRequest(...args)
                      isIntercepting = false
                      return result
                    } catch (addError) {
                      isIntercepting = false
                      console.error('❌ Failed to auto-add network:', addError)
                      throw addError
                    }
                  }
                }
              }
              throw error
            }
          }
          
          // For all other requests, use original method
          return await originalRequest(...args)
        } catch (error) {
          // If override fails, fallback to original
          console.warn('⚠️ Request override failed, using original:', error)
          return await originalRequest(...args)
        }
      }

      return () => {
        // Restore original request on unmount safely
        try {
          if (window.ethereum && originalRequest) {
            window.ethereum.request = originalRequest
          }
        } catch (cleanupError) {
          console.warn('⚠️ Failed to restore original request:', cleanupError)
        }
      }
    } catch (error) {
      console.error('❌ Failed to setup request interceptor:', error)
      // Don't throw - let the app continue without interceptor
    }
  }, [switchToNetwork, isWeb])

  return null // This component doesn't render anything
}
