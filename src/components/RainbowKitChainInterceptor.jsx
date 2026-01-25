import { useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { shouldUseRainbowKit } from '../config/rainbowkit'

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

  // Only run on web, not in Farcaster
  if (!isWeb) {
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

  // Also intercept wagmi's switchChain calls
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') {
      return
    }

    // Store original request method
    const originalRequest = window.ethereum.request.bind(window.ethereum)
    let isIntercepting = false

    window.ethereum.request = async function(...args) {
      // Only intercept wallet_switchEthereumChain calls
      if (args[0]?.method === 'wallet_switchEthereumChain' && !isIntercepting) {
        try {
          return await originalRequest(...args)
        } catch (error) {
          // If chain not added (error 4902), add it automatically
          if (
            error.code === 4902 || 
            error.message?.includes('not been added') || 
            error.message?.includes('Unrecognized chain ID')
          ) {
            const chainIdHex = args[0]?.params?.[0]?.chainId
            if (chainIdHex) {
              const targetChainId = parseInt(chainIdHex, 16)
              console.log('🔄 Auto-adding network:', targetChainId)
              isIntercepting = true
              try {
                await switchToNetwork(targetChainId)
                console.log('✅ Network auto-added, retrying switch...')
                // Retry the original request
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
          throw error
        }
      }
      
      // For all other requests, use original method
      return await originalRequest(...args)
    }

    return () => {
      // Restore original request on unmount
      if (window.ethereum && originalRequest) {
        window.ethereum.request = originalRequest
      }
    }
  }, [switchToNetwork, isWeb])

  return null // This component doesn't render anything
}
