import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { getCurrentConfig } from '../config/base'

export const useNetworkCheck = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const baseConfig = getCurrentConfig()
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      setIsCorrectNetwork(false)
      return
    }

    setIsChecking(true)
    
    // Check if user is on the correct network (Base Mainnet only)
    const correctChainId = baseConfig.chainId
    const isOnBase = chainId === correctChainId
    
    setIsCorrectNetwork(isOnBase)
    setIsChecking(false)
    
    console.log('🔍 Network Check:', {
      currentChainId: chainId,
      requiredChainId: correctChainId,
      isOnBase,
      networkName: baseConfig.chainName
    })
    
    // If not on Base, show immediate warning
    if (!isOnBase) {
      console.warn('⚠️ WRONG NETWORK DETECTED!')
      console.warn(`Current: ${getNetworkName(chainId)} (Chain ID: ${chainId})`)
      console.warn(`Required: ${baseConfig.chainName} (Chain ID: ${correctChainId})`)
    }
  }, [isConnected, chainId, baseConfig.chainId])

  const switchToBaseNetwork = async () => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not detected. Please install MetaMask to switch networks.')
    }

    console.log('🔄 Attempting to switch to Base network...')
    console.log('Current chain ID:', chainId)
    console.log('Required chain ID:', baseConfig.chainId)

    try {
      // Try to switch to Base network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${baseConfig.chainId.toString(16)}` }],
      })
      console.log('✅ Successfully switched to Base network')
    } catch (switchError) {
      console.log('❌ Switch failed, attempting to add network...', switchError)
      
      // If the chain hasn't been added to MetaMask, add it
      if (switchError.code === 4902) {
        try {
          console.log('➕ Adding Base network to wallet...')
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${baseConfig.chainId.toString(16)}`,
              chainName: baseConfig.chainName,
              nativeCurrency: baseConfig.nativeCurrency,
              rpcUrls: baseConfig.rpcUrls,
              blockExplorerUrls: baseConfig.blockExplorerUrls,
            }],
          })
          console.log('✅ Successfully added Base network')
        } catch (addError) {
          console.error('❌ Failed to add Base network:', addError)
          throw new Error('Failed to add Base network to your wallet. Please add it manually.')
        }
      } else if (switchError.code === 4001 || switchError.message?.includes('not been authorized')) {
        // User rejected the request - this is normal in Farcaster
        console.log('ℹ️ User rejected network switch request (this is normal in Farcaster)')
        // Don't throw error, just log it
        return
      } else {
        console.error('❌ Failed to switch to Base network:', switchError)
        // In Farcaster, network switching might not be supported
        // Don't throw error, just log it
        console.log('ℹ️ Network switch not available (may be in Farcaster environment)')
        return
      }
    }
  }

  const getNetworkName = (chainId) => {
    // Only support Base mainnet
    if (chainId === 8453) {
      return 'Base'
    }
    return `Unsupported Network (Chain ID: ${chainId})`
  }

  return {
    isCorrectNetwork,
    isChecking,
    currentChainId: chainId,
    requiredChainId: baseConfig.chainId,
    networkName: getNetworkName(chainId),
    baseNetworkName: baseConfig.chainName,
    switchToBaseNetwork,
  }
}
