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
      
      // Show alert to user with stronger message
      alert(`🚫 BASE AĞI GEREKLİ!\n\nŞu anda ${getNetworkName(chainId)} ağındasınız.\nBaseHub SADECE Base ağında çalışır.\n\nLütfen cüzdanınızı Base ağına geçirin!\n\nBase ağına geçmeden işlem yapamazsınız.`)
      
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
            // Show another alert if auto-switch fails
            setTimeout(() => {
              alert(`❌ Otomatik ağ geçişi başarısız!\n\nLütfen manuel olarak Base ağına geçin.\n\nBase ağına geçmeden işlem yapamazsınız.`)
            }, 1000)
          })
        } catch (error) {
          console.log('❌ Auto-switch failed:', error)
          // Show another alert if auto-switch fails
          setTimeout(() => {
            alert(`❌ Otomatik ağ geçişi başarısız!\n\nLütfen manuel olarak Base ağına geçin.\n\nBase ağına geçmeden işlem yapamazsınız.`)
          }, 1000)
        }
      }
    } else if (isOnBase) {
      setHasShownAlert(false)
    }
  }, [isConnected, chainId, baseConfig.chainId, hasShownAlert])

  const getNetworkName = (chainId) => {
    // Only support Base mainnet
    if (chainId === 8453) {
      return 'Base'
    }
    return `Unsupported Network (Chain ID: ${chainId})`
  }

  return {
    isOnBase: chainId === baseConfig.chainId,
    currentNetwork: getNetworkName(chainId),
    requiredNetwork: baseConfig.chainName
  }
}
