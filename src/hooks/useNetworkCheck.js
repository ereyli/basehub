import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { NETWORKS, isNetworkSupported, getNetworkConfig, getAddChainParams } from '../config/networks'

/** Cüzdanlar bazen code'u string "4902" veya cause/error içinde döndürür. */
function isChainNotAddedError(err) {
  if (!err) return false
  const code = err.code ?? err.cause?.code ?? err.error?.code
  const msg = (err.message || err.cause?.message || err.error?.message || '').toLowerCase()
  if (Number(code) === 4902 || String(code) === '4902') return true
  return msg.includes('not been added') || msg.includes('unrecognized chain') || msg.includes('unknown chain')
}

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

    const chainIdHex = `0x${targetChainId.toString(16)}`
    const rpcUrlFirst = Array.isArray(targetNetwork.rpcUrls) && targetNetwork.rpcUrls[0] && String(targetNetwork.rpcUrls[0]).startsWith('https://')
      ? String(targetNetwork.rpcUrls[0])
      : null
    if (!rpcUrlFirst) {
      throw new Error(`Invalid RPC URL for ${targetNetwork.chainName}.`)
    }

    // MetaMask kesinlikle rpcUrls = string[] ister; literal dizi ile tek URL gönderiyoruz
    const addPayload = {
      chainId: chainIdHex,
      chainName: String(targetNetwork.chainName),
      nativeCurrency: {
        name: String(targetNetwork.nativeCurrency.name),
        symbol: String(targetNetwork.nativeCurrency.symbol),
        decimals: Number(targetNetwork.nativeCurrency.decimals),
      },
      rpcUrls: [rpcUrlFirst],
    }
    const blockExplorerFirst = targetNetwork.blockExplorerUrls?.[0] || (Array.isArray(targetNetwork.blockExplorerUrls) ? targetNetwork.blockExplorerUrls[0] : null)
    if (blockExplorerFirst && String(blockExplorerFirst).startsWith('http')) {
      addPayload.blockExplorerUrls = [String(blockExplorerFirst)]
    }

    // Tüm ağlar (mainnet + testnet): önce "Ağ ekle" isteği gönder; cüzdanda yoksa onay çıkar, varsa hata verir (yok sayarız)
    console.log(`🔄 Ağ seçildi: önce ağ ekleme isteği gönderiliyor (${targetNetwork.chainName})...`)
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [addPayload],
      })
      console.log(`✅ Ağ eklendi veya zaten vardı`)
    } catch (addErr) {
      if (Number(addErr?.code) === 4001 || String(addErr?.code) === '4001' || (addErr?.message || '').toLowerCase().includes('reject')) {
        throw new Error('Network addition was cancelled')
      }
      // "Chain already added" veya benzeri: devam et, switch deneyeceğiz
      console.log('ℹ️ Add chain result (devam ediliyor):', addErr?.message || addErr)
    }
    await new Promise(resolve => setTimeout(resolve, 300))

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      console.log(`✅ ${targetNetwork.chainName} ağına geçildi`)
    } catch (switchError) {
      if (isChainNotAddedError(switchError)) {
        // Switch 4902 verdi (ağ eklenmemiş); add tekrar dene (kullanıcı ilk add'i reddetmiş olabilir)
        try {
          console.log(`➕ Ağ cüzdana ekleniyor: ${targetNetwork.chainName}...`)
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [addPayload],
          })
          await new Promise(resolve => setTimeout(resolve, 500))
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          })
          console.log(`✅ Ağ eklendi ve geçiş yapıldı`)
        } catch (addError) {
          if (Number(addError?.code) === 4001 || String(addError?.code) === '4001') {
            throw new Error('Network addition was cancelled')
          }
          throw new Error(`Failed to add network: ${addError?.message || 'Unknown error'}`)
        }
      } else if (Number(switchError?.code) === 4001 || String(switchError?.code) === '4001' || (switchError?.message || '').toLowerCase().includes('reject')) {
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
