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

    // Prevent infinite loops - check if we're already on the target network
    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      const currentChainIdDecimal = parseInt(currentChainId, 16)
      
      if (currentChainIdDecimal === targetChainId) {
        console.log(`✅ Already on ${targetNetwork.chainName} network`)
        return
      }
      
      console.log(`🔄 Attempting to switch to ${targetNetwork.chainName} network...`)
      console.log('Current chain ID:', currentChainIdDecimal)
      console.log('Target chain ID:', targetChainId)
    } catch (chainIdError) {
      console.warn('⚠️ Could not get current chain ID:', chainIdError)
      // Continue anyway
    }

    // Ensure rpcUrls is an array and has valid HTTPS URLs
    const rpcUrls = Array.isArray(targetNetwork.rpcUrls) 
      ? targetNetwork.rpcUrls.filter(url => url && typeof url === 'string' && url.startsWith('https://'))
      : (targetNetwork.rpcUrls && typeof targetNetwork.rpcUrls === 'string' && targetNetwork.rpcUrls.startsWith('https://'))
        ? [targetNetwork.rpcUrls]
        : []
    
    if (rpcUrls.length === 0) {
      throw new Error(`Invalid RPC URLs for ${targetNetwork.chainName}. Please check network configuration.`)
    }

    // Ensure blockExplorerUrls is an array
    const blockExplorerUrls = Array.isArray(targetNetwork.blockExplorerUrls)
      ? targetNetwork.blockExplorerUrls.filter(Boolean)
      : (targetNetwork.blockExplorerUrls ? [targetNetwork.blockExplorerUrls] : [])

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
      if (switchError.code === 4902 || switchError.message?.includes('not been added') || switchError.message?.includes('Unrecognized chain ID')) {
        try {
          console.log(`➕ Adding ${targetNetwork.chainName} network to wallet...`)
          
          const addChainParams = {
            chainId: `0x${targetChainId.toString(16)}`,
            chainName: targetNetwork.chainName,
            nativeCurrency: targetNetwork.nativeCurrency,
            rpcUrls: rpcUrls,
          }
          
          // Only add blockExplorerUrls if we have them
          if (blockExplorerUrls.length > 0) {
            addChainParams.blockExplorerUrls = blockExplorerUrls
          }
          
          console.log('Network config:', addChainParams)
          
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [addChainParams],
          })
          console.log(`✅ Successfully added ${targetNetwork.chainName} network`)
          
          // Wait a bit for the network to be added
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // After adding, automatically switch to the network
          console.log(`🔄 Automatically switching to ${targetNetwork.chainName} network...`)
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${targetChainId.toString(16)}` }],
            })
            console.log(`✅ Successfully switched to ${targetNetwork.chainName} network after adding`)
          } catch (retrySwitchError) {
            console.error(`❌ Failed to switch after adding network:`, retrySwitchError)
            // Some wallets automatically switch after adding, so check if we're already on the network
            const newChainId = await window.ethereum.request({ method: 'eth_chainId' })
            const newChainIdDecimal = parseInt(newChainId, 16)
            if (newChainIdDecimal === targetChainId) {
              console.log(`✅ Already on ${targetNetwork.chainName} network (wallet auto-switched)`)
              return
            }
            // If user rejected, don't throw error
            if (retrySwitchError.code !== 4001) {
              throw retrySwitchError
            }
          }
        } catch (addError) {
          console.error(`❌ Failed to add ${targetNetwork.chainName} network:`, addError)
          if (addError.code === 4001) {
            throw new Error('Network addition was cancelled')
          }
          // Check for RPC URL format error
          if (addError.message?.includes('rpcUrls') || addError.code === -32602) {
            throw new Error(`Invalid RPC URL format for ${targetNetwork.chainName}. RPC URLs must be valid HTTPS URLs.`)
          }
          throw new Error(`Failed to add ${targetNetwork.chainName} network to your wallet: ${addError.message || 'Unknown error'}`)
        }
      } else if (switchError.code === 4001 || switchError.message?.includes('not been authorized') || switchError.message?.includes('cancelled')) {
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
