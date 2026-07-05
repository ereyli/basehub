import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { isNetworkSupported, getNetworkConfig, NETWORKS } from '../config/networks'

export const useNetworkInterceptor = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [hasShownAlert, setHasShownAlert] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      setHasShownAlert(false)
      return
    }

    // Check if current network is supported by BaseHub.
    const isSupported = isNetworkSupported(chainId)
    
    if (!isSupported && !hasShownAlert) {
      const currentNetwork = getNetworkConfig(chainId)
      const supportedNetworkNames = Object.values(NETWORKS)
        .filter(network => network && !network.isTestnet)
        .map(network => network.chainName)
        .join(', ')
      console.log('🚨 UNSUPPORTED NETWORK DETECTED!')
      console.log('Current network:', currentNetwork?.chainName || `Unknown (Chain ID: ${chainId})`)
      console.log('Supported networks:', supportedNetworkNames)
      
      setHasShownAlert(true)
      
      // Show alert to user
      alert(`🚫 UNSUPPORTED NETWORK!\n\nYou are currently on ${currentNetwork?.chainName || `Unknown Network (Chain ID: ${chainId})`}.\nBaseHub works on supported mainnet networks such as Base, Arbitrum, Optimism, Monad, InkChain and Soneium.\n\nPlease switch to a supported network.`)
    } else if (isSupported) {
      setHasShownAlert(false)
    }
  }, [isConnected, chainId, hasShownAlert])

  const currentNetwork = getNetworkConfig(chainId)

  return {
    isOnSupportedNetwork: isNetworkSupported(chainId),
    isOnBase: chainId === NETWORKS.BASE.chainId,
    isOnInkChain: chainId === NETWORKS.INKCHAIN.chainId,
    currentNetwork: currentNetwork?.chainName || `Unknown (Chain ID: ${chainId})`,
    supportedNetworks: Object.values(NETWORKS).filter(network => network && !network.isTestnet).map(network => network.chainName)
  }
}
