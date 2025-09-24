import React, { useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { getPreferredConnector, isInFarcaster } from '../config/wagmi'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { Wallet, LogOut, User } from 'lucide-react'

function WalletConnect() {
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { isCorrectNetwork, switchToBaseNetwork } = useNetworkCheck()

  // Auto-switch to Base network when wallet connects
  useEffect(() => {
    if (isConnected && !isCorrectNetwork) {
      console.log('🔄 Wallet connected but not on Base network, switching...')
      switchToBaseNetwork().catch(error => {
        console.error('Failed to auto-switch to Base:', error)
      })
    }
  }, [isConnected, isCorrectNetwork, switchToBaseNetwork])

  const handleConnect = () => {
    const preferredConnector = getPreferredConnector(connectors)
    connect({ connector: preferredConnector })
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
          <User size={16} />
          <span className="wallet-address">{formatAddress(address)}</span>
          {isInFarcaster() && (
            <span className="farcaster-badge">Farcaster</span>
          )}
        </div>
        <button 
          onClick={() => disconnect()}
          className="disconnect-btn"
          title="Disconnect Wallet"
        >
          <LogOut size={16} />
        </button>
      </div>
    )
  }

  return (
    <button 
      onClick={handleConnect}
      className="connect-wallet-btn"
    >
      <Wallet size={16} />
      <span>
        {isInFarcaster() ? 'Connect Farcaster Wallet' : 'Connect Wallet'}
      </span>
    </button>
  )
}

export default WalletConnect
