import React, { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Zap, Wallet, Home, LogOut, Wifi, RefreshCw, Users } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getXP, getNFTCount } from '../utils/xpUtils'
import { useFarcaster } from '../contexts/FarcasterContext'
import { useNetworkCheck } from '../hooks/useNetworkCheck'
import { useProofOfUsage } from '../hooks/useProofOfUsage'
import { useSupabase } from '../hooks/useSupabase'
import UserProfile from './UserProfile'

const FarcasterXPDisplay = () => {
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { isInFarcaster } = useFarcaster()
  const { isCorrectNetwork, switchToBaseNetwork } = useNetworkCheck()
  const { totalUsers, loading: proofLoading } = useProofOfUsage()
  const { supabase } = useSupabase()
  const navigate = useNavigate()
  const location = useLocation()
  const [totalXP, setTotalXP] = useState(0)
  const [isSwitching, setIsSwitching] = useState(false)
  const [nftCount, setNftCount] = useState(0)
  const [multiplier, setMultiplier] = useState(1)
  
  // In Farcaster, only Base is supported - no auto-switch needed
  // RainbowKit will handle network selection in web environment
  
  // Check if we're on home page
  const isHomePage = location.pathname === '/'

  // Load NFT count only once when component mounts or address changes
  useEffect(() => {
    const loadNFTCount = async () => {
      if (isConnected && address) {
        try {
          const count = await getNFTCount(address)
          setNftCount(count)
          setMultiplier(count > 0 ? count + 1 : 1)
        } catch (nftError) {
          console.warn('⚠️ Error loading NFT count:', nftError)
          setNftCount(0)
          setMultiplier(1)
        }
      } else {
        setNftCount(0)
        setMultiplier(1)
      }
    }

    loadNFTCount()
  }, [isConnected, address])

  // Load XP from Supabase and refresh every 3 seconds
  useEffect(() => {
    const loadXP = async () => {
      if (isConnected && address && supabase) {
        try {
          // Try to get XP directly from Supabase (same as Profile page)
          // All wallet addresses are now normalized to lowercase in Supabase
          const walletAddressLower = address.toLowerCase()
          const { data: player, error: playerError } = await supabase
            .from('players')
            .select('total_xp')
            .eq('wallet_address', walletAddressLower)
            .single()

          if (!playerError && player && player.total_xp !== undefined && player.total_xp !== null) {
            console.log('📊 FarcasterXPDisplay: Using total_xp from Supabase:', player.total_xp)
            setTotalXP(player.total_xp)
          } else {
            // Fallback to getXP function
            console.log('⚠️ FarcasterXPDisplay: Player not found in Supabase, using getXP fallback')
            const xp = await getXP(address)
            setTotalXP(xp)
          }
        } catch (error) {
          console.error('❌ Error loading XP in FarcasterXPDisplay:', error)
          // Fallback to getXP
          try {
            const xp = await getXP(address)
            setTotalXP(xp)
          } catch (fallbackError) {
            console.error('❌ Error in getXP fallback:', fallbackError)
            setTotalXP(0)
          }
        }
      } else {
        setTotalXP(0)
      }
    }

    loadXP()
    const interval = setInterval(loadXP, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [isConnected, address, supabase])

  const handleConnect = (connector) => {
    connect({ connector })
  }

  const handleDisconnect = () => {
    disconnect()
  }


  const handleHomeClick = () => {
    navigate('/')
  }

  const handleSwitchNetwork = async () => {
    setIsSwitching(true)
    try {
      await switchToBaseNetwork()
    } catch (error) {
      console.error('Failed to switch network:', error)
    } finally {
      setIsSwitching(false)
    }
  }

  // If not connected, show header connect version
  if (!isConnected || !address) {
    return (
      <div className="farcaster-header-bar not-connected">
        <div className="header-left">
          {!isHomePage && (
            <button className="home-button" onClick={handleHomeClick} title="Home">
              <Home size={16} />
            </button>
          )}
          <div className="not-connected-text">
            <Wallet size={16} />
            <span>Not Connected</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="wallet-dropdown">
            <button className="header-connect-button">
              <span>Connect Wallet</span>
            </button>
            <div className="wallet-options">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  className="wallet-option"
                  onClick={() => handleConnect(connector)}
                >
                  <Wallet size={16} />
                  <span>{connector.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* User Profile Button */}
          <UserProfile />
        </div>
      </div>
    )
  }

  return (
    <div className="farcaster-header-bar">
      <div className="header-left">
        {!isHomePage && (
          <button className="home-button" onClick={handleHomeClick} title="Home">
            <Home size={16} />
          </button>
        )}
        <button
          type="button"
          className="disconnect-button"
          title="Disconnect Wallet"
          aria-label="Disconnect Wallet"
          onClick={handleDisconnect}
          onTouchEnd={(e) => {
            e.preventDefault()
            handleDisconnect()
          }}
        >
          <LogOut size={16} />
        </button>
        <div className="player-info">
          <span className="wallet-address">{address.slice(0, 4)}..{address.slice(-2)}</span>
        </div>
      </div>
      
      <div className="header-right">
        {/* Proof of Usage */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          marginRight: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: '#e5e7eb'
          }}>
            <Users size={12} style={{ color: '#3b82f6' }} />
            <span style={{ fontWeight: '500', color: '#9ca3af', fontSize: '10px' }}>users:</span>
            <span style={{ fontWeight: '700', color: '#e5e7eb' }}>
              {proofLoading ? '...' : totalUsers.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Switch Network Button - only show when not on Base */}
        {isConnected && !isInFarcaster && !isCorrectNetwork && (
          <button 
            onClick={handleSwitchNetwork}
            disabled={isSwitching}
            className="switch-network-btn-mini"
          >
            {isSwitching ? (
              <>
                <RefreshCw size={12} className="spinning" />
                <span>Switching...</span>
              </>
            ) : (
              <>
                <Wifi size={12} />
                <span>Switch to Base</span>
              </>
            )}
          </button>
        )}

        <div 
          className="stat-mini xp" 
          title={multiplier > 1 ? `${multiplier}x multiplier (${nftCount} NFT${nftCount > 1 ? 's' : ''})` : ''}
          style={{ position: 'relative' }}
        >
          <Zap size={14} />
          <span>{totalXP}</span>
          {multiplier > 1 && (
            <span style={{
              marginLeft: '4px',
              padding: '1px 4px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: '700',
              color: '#fff'
            }}>
              {multiplier}x
            </span>
          )}
        </div>
        
        {/* User Profile Button */}
        <UserProfile />
      </div>
    </div>
  )
}

export default FarcasterXPDisplay