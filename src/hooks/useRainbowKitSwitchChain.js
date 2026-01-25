import { useSwitchChain as useWagmiSwitchChain } from 'wagmi'
import { useNetworkCheck } from './useNetworkCheck'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { useRef } from 'react'

/**
 * Custom hook that wraps Wagmi's useSwitchChain to automatically add networks
 * when switching fails due to network not being added
 */
export const useRainbowKitSwitchChain = () => {
  const wagmiSwitchChain = useWagmiSwitchChain()
  const { switchToNetwork } = useNetworkCheck()
  const isWeb = shouldUseRainbowKit()
  const isProcessingRef = useRef(false)
  const processingChainIdRef = useRef(null)

  const switchChain = async (params) => {
    if (!isWeb) {
      // Not using RainbowKit, use regular switchChain
      return wagmiSwitchChain.switchChain(params)
    }

    // Prevent multiple simultaneous calls for the same chain
    if (isProcessingRef.current && processingChainIdRef.current === params.chainId) {
      console.log('⏳ Network switch already in progress for this chain, skipping...')
      return { success: false, alreadyProcessing: true }
    }

    isProcessingRef.current = true
    processingChainIdRef.current = params.chainId

    try {
      // Try RainbowKit's switchChain first
      const result = await wagmiSwitchChain.switchChain(params)
      isProcessingRef.current = false
      processingChainIdRef.current = null
      return result
    } catch (error) {
      console.log('🔄 RainbowKit switchChain failed, attempting auto-add network...', error)
      
      // Check if error is due to network not being added
      if (
        error?.code === 4902 || 
        error?.message?.includes('not been added') || 
        error?.message?.includes('Unrecognized chain ID') ||
        error?.cause?.code === 4902 ||
        error?.cause?.message?.includes('not been added')
      ) {
        console.log('➕ Network not added, attempting to add automatically...')
        try {
          // Use our switchToNetwork which automatically adds the network
          await switchToNetwork(params.chainId)
          console.log('✅ Network added and switched successfully')
          isProcessingRef.current = false
          processingChainIdRef.current = null
          // Return a success-like object to match Wagmi's return type
          return { success: true }
        } catch (addError) {
          console.error('❌ Failed to add network automatically:', addError)
          isProcessingRef.current = false
          processingChainIdRef.current = null
          // Re-throw the original error or the add error
          throw addError
        }
      }
      
      isProcessingRef.current = false
      processingChainIdRef.current = null
      // If it's not a "network not added" error, re-throw the original error
      throw error
    }
  }

  return {
    ...wagmiSwitchChain,
    switchChain,
  }
}
