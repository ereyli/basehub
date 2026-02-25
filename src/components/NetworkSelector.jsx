import React, { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { NETWORKS, getNetworkConfig, getMainnetNetworks, getTestnetNetworks } from '../config/networks'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { Wifi, ChevronDown } from 'lucide-react'

const iconStyle = { width: '20px', height: '20px', borderRadius: '6px', objectFit: 'cover' }
function MegaETHIcon({ isActive }) {
  const [imgError, setImgError] = useState(false)
  if (imgError) {
    return (
      <span
        style={{
          ...iconStyle,
          background: '#3b82f6',
          color: '#fff',
          fontSize: '11px',
          fontWeight: '700',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isActive ? 1 : 0.6,
        }}
        aria-hidden
      >
        M
      </span>
    )
  }
  return (
    <img
      src="/megaeth-logo.jpg"
      alt="MegaETH"
      style={{ ...iconStyle, opacity: isActive ? 1 : 0.6 }}
      onError={() => setImgError(true)}
    />
  )
}

const NetworkSelector = () => {
  const { chainId, isConnected } = useAccount()
  const { switchToNetwork } = useNetworkCheck()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const dropdownRef = useRef(null)
  
  // Debug logging - ALWAYS log to see if component is rendering
  useEffect(() => {
    console.log('🔍 NetworkSelector Component Rendered:', {
      isConnected,
      chainId,
      isOpen,
      timestamp: new Date().toISOString()
    })
  }, [isConnected, chainId, isOpen])
  
  // Force render a visible element for debugging
  console.log('🔍 NetworkSelector Function Called - Component should render')
  
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
  
  const mainnetNetworks = getMainnetNetworks()
  const testnetNetworks = getTestnetNetworks()
  const supportedNetworks = mainnetNetworks.concat(testnetNetworks)
  
  const handleNetworkSelect = async (targetChainId) => {
    if (!isConnected) {
      console.warn('⚠️ Please connect wallet first to switch networks')
      setIsOpen(false)
      return
    }
    
    // Check if already on target network
    if (targetChainId === currentChainId) {
      setIsOpen(false)
      return
    }
    
    console.log('🔄 Switching to network:', targetChainId)
    setIsOpen(false)
    setIsPending(true)
    
    try {
      // Use switchToNetwork which automatically handles adding network if needed
      await switchToNetwork(targetChainId)
      console.log('✅ Network switch successful')
      
      // Wait a moment for the network switch to complete
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error('❌ Network switch failed:', error)
      
      if (error.message?.includes('cancelled') || error.message?.includes('rejected')) {
        console.log('ℹ️ User rejected network switch')
        // Don't show alert for user cancellation
      } else {
        alert(`Failed to switch network: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setIsPending(false)
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
        {currentNetwork.chainId === NETWORKS.BASE.chainId ? (
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
        ) : currentNetwork.chainId === NETWORKS.INKCHAIN.chainId ? (
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
        ) : currentNetwork.chainId === NETWORKS.SONEIUM.chainId ? (
          <img 
            src="/soneium-logo.jpg" 
            alt="Soneium" 
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              objectFit: 'cover'
            }}
          />
        ) : currentNetwork.chainId === NETWORKS.KATANA.chainId ? (
          <img 
            src="/katana-logo.jpg" 
            alt="Katana" 
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              objectFit: 'cover'
            }}
          />
        ) : currentNetwork.chainId === NETWORKS.MEGAETH?.chainId ? (
          <img 
            src="/megaeth-logo.jpg" 
            alt="MegaETH" 
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              objectFit: 'cover'
            }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : currentNetwork.chainId === NETWORKS.ARC_RESTNET?.chainId ? (
          <img 
            src="/arc-testnet-logo.jpg" 
            alt="Arc Testnet" 
            style={{
              width: 20,
              height: 20,
              minWidth: 20,
              minHeight: 20,
              borderRadius: '6px',
              objectFit: 'contain',
              display: 'block',
              backgroundColor: 'rgba(255,255,255,0.1)'
            }}
          />
        ) : currentNetwork.chainId === NETWORKS.ROBINHOOD_TESTNET?.chainId ? (
          <img 
            src="/robinhood-testnet-logo.png" 
            alt="Robinhood Chain Testnet" 
            style={{
              width: 20,
              height: 20,
              minWidth: 20,
              minHeight: 20,
              borderRadius: '6px',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        ) : (
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
          {mainnetNetworks.length > 0 && (
            <>
              <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Mainnet</div>
              {mainnetNetworks.map(network => renderNetworkButton(network, currentChainId, handleNetworkSelect))}
            </>
          )}
          {testnetNetworks.length > 0 && (
            <>
              <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>Testnet</div>
              {testnetNetworks.map(network => renderNetworkButton(network, currentChainId, handleNetworkSelect))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function renderNetworkButton(network, currentChainId, handleNetworkSelect) {
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
        background: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
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
      {network.chainId === NETWORKS.BASE?.chainId ? (
        <img src="/base-logo.jpg" alt="Base" style={{ width: '20px', height: '20px', borderRadius: '6px', objectFit: 'cover', opacity: isActive ? 1 : 0.6 }} />
      ) : network.chainId === NETWORKS.INKCHAIN?.chainId ? (
        <img src="/ink-logo.jpg" alt="InkChain" style={{ width: '20px', height: '20px', borderRadius: '6px', objectFit: 'cover', opacity: isActive ? 1 : 0.6 }} />
      ) : network.chainId === NETWORKS.SONEIUM?.chainId ? (
        <img src="/soneium-logo.jpg" alt="Soneium" style={{ width: '20px', height: '20px', borderRadius: '6px', objectFit: 'cover', opacity: isActive ? 1 : 0.6 }} />
      ) : network.chainId === NETWORKS.KATANA?.chainId ? (
        <img src="/katana-logo.jpg" alt="Katana" style={{ width: '20px', height: '20px', borderRadius: '6px', objectFit: 'cover', opacity: isActive ? 1 : 0.6 }} />
      ) : network.chainId === NETWORKS.MEGAETH?.chainId ? (
        <img src="/megaeth-logo.jpg" alt="MegaETH" style={{ width: '20px', height: '20px', borderRadius: '6px', objectFit: 'cover', opacity: isActive ? 1 : 0.6 }} onError={(e) => { e.target.style.display = 'none' }} />
      ) : network.chainId === NETWORKS.ARC_RESTNET?.chainId ? (
        <img src="/arc-testnet-logo.jpg" alt="Arc Testnet" style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, borderRadius: '6px', objectFit: 'contain', opacity: isActive ? 1 : 0.6, display: 'block', backgroundColor: 'rgba(255,255,255,0.1)' }} />
      ) : network.chainId === NETWORKS.ROBINHOOD_TESTNET?.chainId ? (
        <img src="/robinhood-testnet-logo.png" alt="Robinhood Chain Testnet" style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, borderRadius: '6px', objectFit: 'contain', opacity: isActive ? 1 : 0.6, display: 'block' }} />
      ) : (
        <img src="/base-logo.jpg" alt="" style={{ width: '20px', height: '20px', borderRadius: '6px', objectFit: 'cover', opacity: isActive ? 1 : 0.6 }} />
      )}
      <span>{network.chainName}</span>
      {isActive && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#60a5fa' }}>✓</span>}
    </button>
  )
}

export default NetworkSelector
