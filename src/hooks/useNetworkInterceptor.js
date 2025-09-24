import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { getCurrentConfig } from '../config/base'

export const useNetworkInterceptor = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const baseConfig = getCurrentConfig()
  const [hasShownAlert, setHasShownAlert] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      setHasShownAlert(false)
      return
    }

    const isOnBase = chainId === baseConfig.chainId
    
    if (!isOnBase && !hasShownAlert) {
      console.log('🚨 WRONG NETWORK DETECTED!')
      console.log('Current network:', getNetworkName(chainId))
      console.log('Required network:', baseConfig.chainName)
      console.log('Chain ID:', chainId, 'vs Required:', baseConfig.chainId)
      
      setHasShownAlert(true)
      
      // Show alert to user
      alert(`⚠️ YANLIŞ AĞ UYARISI!\n\nŞu anda ${getNetworkName(chainId)} ağındasınız.\nBaseHub sadece Base ağında çalışır.\n\nLütfen cüzdanınızı Base ağına geçirin!\n\nBu uyarıyı kapatmak için Base ağına geçin.`)
      
      // Also try to automatically switch
      if (typeof window.ethereum !== 'undefined') {
        try {
          window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${baseConfig.chainId.toString(16)}` }],
          }).then(() => {
            console.log('✅ Auto-switched to Base network')
            setHasShownAlert(false)
          }).catch((error) => {
            console.log('❌ Auto-switch failed:', error)
          })
        } catch (error) {
          console.log('❌ Auto-switch failed:', error)
        }
      }
    } else if (isOnBase) {
      setHasShownAlert(false)
    }
  }, [isConnected, chainId, baseConfig.chainId, hasShownAlert])

  const getNetworkName = (chainId) => {
    const networks = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      10: 'Optimism',
      56: 'BSC',
      137: 'Polygon',
      8453: 'Base',
      84532: 'Base Sepolia',
      42161: 'Arbitrum',
      421614: 'Arbitrum Sepolia',
    }
    return networks[chainId] || `Chain ID: ${chainId}`
  }

  return {
    isOnBase: chainId === baseConfig.chainId,
    currentNetwork: getNetworkName(chainId),
    requiredNetwork: baseConfig.chainName
  }
}
