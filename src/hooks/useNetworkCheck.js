import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { NETWORKS, isNetworkSupported, getNetworkConfig } from '../config/networks'

export const useNetworkCheck = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      setIsCorrectNetwork(false)
      return
    }

    setIsChecking(true)
    
    // Check if user is on a supported network (Base or InkChain)
    const isSupported = isNetworkSupported(chainId)
    
    setIsCorrectNetwork(isSupported)
    setIsChecking(false)
    
    const currentNetwork = getNetworkConfig(chainId)
    
    console.log('🔍 Network Check:', {
      currentChainId: chainId,
      isSupported,
      networkName: currentNetwork?.chainName || 'Unknown'
    })
    
    // If not on supported network, show warning
    if (!isSupported) {
      console.warn('⚠️ UNSUPPORTED NETWORK DETECTED!')
      console.warn(`Current: ${getNetworkName(chainId)} (Chain ID: ${chainId})`)
      console.warn(`Supported: Base (${NETWORKS.BASE.chainId}) or InkChain (${NETWORKS.INKCHAIN.chainId})`)
    }
  }, [isConnected, chainId])

  const switchToNetwork = async (targetChainId) => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not detected. Please install MetaMask to switch networks.')
    }

    const targetNetwork = Object.values(NETWORKS).find(net => net.chainId === targetChainId)
    if (!targetNetwork) {
      throw new Error(`Network with chain ID ${targetChainId} is not supported`)
    }

    console.log(`🔄 Attempting to switch to ${targetNetwork.chainName} network...`)
    console.log('Current chain ID:', chainId)
    console.log('Target chain ID:', targetChainId)

    try {
      // Try to switch to target network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      })
      console.log(`✅ Successfully switched to ${targetNetwork.chainName} network`)
    } catch (switchError) {
      console.log('❌ Switch failed, attempting to add network...', switchError)
      
      // If the chain hasn't been added to MetaMask, add it
      if (switchError.code === 4902) {
        try {
          console.log(`➕ Adding ${targetNetwork.chainName} network to wallet...`)
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetChainId.toString(16)}`,
              chainName: targetNetwork.chainName,
              nativeCurrency: targetNetwork.nativeCurrency,
              rpcUrls: targetNetwork.rpcUrls,
              blockExplorerUrls: targetNetwork.blockExplorerUrls,
            }],
          })
          console.log(`✅ Successfully added ${targetNetwork.chainName} network`)
        } catch (addError) {
          console.error(`❌ Failed to add ${targetNetwork.chainName} network:`, addError)
          throw new Error(`Failed to add ${targetNetwork.chainName} network to your wallet. Please add it manually.`)
        }
      } else if (switchError.code === 4001 || switchError.message?.includes('not been authorized')) {
        // User rejected the request
        console.log('ℹ️ Network switch request was rejected by user')
        throw new Error('Network switch was cancelled')
      } else {
        throw switchError
      }
    }
  }

  // Backward compatibility - switch to Base
  const switchToBaseNetwork = async () => {
    return switchToNetwork(NETWORKS.BASE.chainId)
  }

  const getNetworkName = (chainId) => {
    const network = Object.values(NETWORKS).find(net => net.chainId === chainId)
    return network ? network.chainName : `Unsupported Network (Chain ID: ${chainId})`
  }

  const currentNetwork = getNetworkConfig(chainId)

  return {
    isCorrectNetwork,
    isChecking,
    currentChainId: chainId,
    isOnBase: chainId === NETWORKS.BASE.chainId,
    isOnInkChain: chainId === NETWORKS.INKCHAIN.chainId,
    networkName: getNetworkName(chainId),
    currentNetworkConfig: currentNetwork,
    baseNetworkName: NETWORKS.BASE.chainName,
    switchToNetwork,
    switchToBaseNetwork, // Backward compatibility
    supportedNetworks: Object.values(NETWORKS)
  }
}
