import React, { useState, useRef, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { NETWORKS, getNetworkConfig } from '../config/networks'
import { shouldUseRainbowKit } from '../config/rainbowkit'
import { useFarcaster } from '../contexts/FarcasterContext'
import { Wifi, ChevronDown } from 'lucide-react'

const NetworkSelector = () => {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const isWeb = shouldUseRainbowKit()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
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
  
  if (!isWeb || isInFarcaster || !isConnected) {
    return null
  }
  
  const currentNetwork = getNetworkConfig(chainId)
  const supportedNetworks = Object.values(NETWORKS)
  
  const handleNetworkSelect = (targetChainId) => {
    if (targetChainId !== chainId) {
      switchChain({ chainId: targetChainId })
      setIsOpen(false)
    }
  }
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  return (
    <div 
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#fff',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          border: 'none',
          borderRadius: '20px',
          cursor: isPending ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          opacity: isPending ? 0.7 : 1
        }}
        onMouseEnter={(e) => {
          if (!isPending) {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isPending) {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
          }
        }}
      >
        <Wifi size={16} />
        <span>{currentNetwork.chainName}</span>
        <ChevronDown 
          size={14} 
          style={{
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>
      
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            minWidth: '180px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {supportedNetworks.map(network => {
            const isActive = network.chainId === chainId
            return (
              <button
                key={network.chainId}
                onClick={() => handleNetworkSelect(network.chainId)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: isActive ? '#60a5fa' : '#e2e8f0',
                  background: isActive 
                    ? 'rgba(59, 130, 246, 0.2)' 
                    : 'transparent',
                  border: 'none',
                  cursor: isActive ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'
                    e.currentTarget.style.color = '#93c5fd'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#e2e8f0'
                  }
                }}
              >
                <Wifi size={16} style={{ opacity: isActive ? 1 : 0.6 }} />
                <span>{network.chainName}</span>
                {isActive && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    color: '#60a5fa'
                  }}>
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NetworkSelector
