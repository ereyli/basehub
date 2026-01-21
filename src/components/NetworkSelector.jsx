import React, { useState, useRef, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { NETWORKS, getNetworkConfig } from '../config/networks'
import { Wifi, ChevronDown } from 'lucide-react'

const NetworkSelector = () => {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 NetworkSelector Render:', {
      isConnected,
      chainId,
      isOpen
    })
  }, [isConnected, chainId, isOpen])
  
  // Default to Base if chainId is undefined
  const currentChainId = chainId || NETWORKS.BASE.chainId
  const currentNetwork = getNetworkConfig(currentChainId)
  
  if (!currentNetwork) {
    console.error('❌ NetworkSelector: currentNetwork is undefined for chainId:', currentChainId)
    // Fallback to Base network
    const fallbackNetwork = NETWORKS.BASE
    return (
      <div style={{
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
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
      }}>
        <img 
          src="/base-logo.jpg" 
          alt="Base" 
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            objectFit: 'cover'
          }}
        />
        <span>{fallbackNetwork.chainName}</span>
        <ChevronDown size={14} />
      </div>
    )
  }
  
  // If not connected, show network selector anyway (user can see available networks)
  // But make it clear they need to connect
  
  const supportedNetworks = Object.values(NETWORKS)
  
  const handleNetworkSelect = (targetChainId) => {
    if (!isConnected) {
      console.warn('⚠️ Please connect wallet first to switch networks')
      setIsOpen(false)
      return
    }
    if (targetChainId !== currentChainId) {
      console.log('🔄 Switching to network:', targetChainId)
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
        display: 'inline-block',
        zIndex: 1001
      }}
    >
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          console.log('🔘 NetworkSelector button clicked, isOpen:', isOpen)
          setIsOpen(!isOpen)
        }}
        disabled={isPending}
        type="button"
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
          opacity: isPending ? 0.7 : 1,
          position: 'relative',
          zIndex: 1001,
          pointerEvents: 'auto'
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
        {currentNetwork.chainId === NETWORKS.BASE.chainId || !isConnected ? (
          <img 
            src="/base-logo.jpg" 
            alt="Base" 
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              objectFit: 'cover'
            }}
          />
        ) : (
          <img 
            src="/ink-logo.jpg" 
            alt="InkChain" 
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              objectFit: 'cover'
            }}
          />
        )}
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
            zIndex: 10000,
            overflow: 'hidden'
          }}
        >
          {supportedNetworks.map(network => {
            const isActive = network.chainId === currentChainId
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
                {network.chainId === NETWORKS.BASE.chainId ? (
                  <img 
                    src="/base-logo.jpg" 
                    alt="Base" 
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      opacity: isActive ? 1 : 0.6
                    }}
                  />
                ) : (
                  <img 
                    src="/ink-logo.jpg" 
                    alt="InkChain" 
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      opacity: isActive ? 1 : 0.6
                    }}
                  />
                )}
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
