import React from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { NETWORKS, getNetworkConfig } from '../config/networks'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { useFarcaster } from '../contexts/FarcasterContext'
import { Wifi, ChevronDown } from 'lucide-react'

const NetworkSelector = () => {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWeb = shouldUseRainbowKit()
  
  // Don't show in Farcaster - only Base is supported there
  let isInFarcaster = false
  try {
    if (!isWeb) {
      const farcasterContext = useFarcaster()
      isInFarcaster = farcasterContext?.isInFarcaster || false
    }
  } catch (error) {
    isInFarcaster = false
  }
  
  if (!isWeb || isInFarcaster) {
    return null
  }
  
  const currentNetwork = getNetworkConfig(chainId)
  const supportedNetworks = Object.values(NETWORKS)
  
  const handleNetworkChange = (e) => {
    const targetChainId = parseInt(e.target.value)
    if (targetChainId !== chainId) {
      switchChain({ chainId: targetChainId })
    }
  }
  
  return (
    <div style={{
      position: 'relative',
      display: 'inline-block'
    }}>
      <select
        value={chainId || NETWORKS.BASE.chainId}
        onChange={handleNetworkChange}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          padding: '8px 32px 8px 12px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#fff',
          background: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '8px',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s ease',
          minWidth: '120px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
        }}
      >
        {supportedNetworks.map(network => (
          <option key={network.chainId} value={network.chainId}>
            {network.chainName}
          </option>
        ))}
      </select>
      <ChevronDown 
        size={16} 
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: '#60a5fa'
        }}
      />
    </div>
  )
}

export default NetworkSelector
