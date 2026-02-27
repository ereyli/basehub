import { useState, useEffect } from 'react'
import { useFarcaster } from '../contexts/FarcasterContext'
import { getCurrentConfig } from '../config/base'

export const useWallet = () => {
  const { isInFarcaster, user, sdk } = useFarcaster()
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [chainId, setChainId] = useState(null)
  const [balance, setBalance] = useState('0')

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (isInFarcaster && user?.walletAddress) {
        // In Farcaster, use the user's wallet address
        setAddress(user.walletAddress)
        setIsConnected(true)
        setChainId(user.chainId || 8453) // Default to Base mainnet
      } else if (typeof window.ethereum !== 'undefined') {
        // Regular web3 wallet
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          if (accounts.length > 0) {
            setAddress(accounts[0])
            setIsConnected(true)
            const chainId = await window.ethereum.request({ method: 'eth_chainId' })
            setChainId(parseInt(chainId, 16))
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error)
        }
      }
    }

    checkConnection()
  }, [isInFarcaster, user])

  const connectWallet = async () => {
    if (isInFarcaster) {
      // In Farcaster, wallet is already connected
      if (user?.walletAddress) {
        setAddress(user.walletAddress)
        setIsConnected(true)
        setChainId(user.chainId || 8453)
      }
      return
    }

    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet to continue')
      return
    }

    setIsLoading(true)
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      })
      
      if (accounts.length > 0) {
        setAddress(accounts[0])
        setIsConnected(true)
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        setChainId(parseInt(chainId, 16))
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
      if (error.code === 4001) {
        alert('Please connect your wallet to continue')
      } else {
        alert('Failed to connect wallet. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const switchToBaseNetwork = async () => {
    if (isInFarcaster) {
      // In Farcaster, network switching is handled by the client
      return
    }

    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask to switch networks')
      return
    }

    // Force Base Mainnet (Chain ID: 8453)
    const baseMainnetConfig = {
      chainId: 8453,
      chainName: 'Base',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://base.drpc.org'],
      blockExplorerUrls: ['https://basescan.org'],
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${baseMainnetConfig.chainId.toString(16)}` }],
      })
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [baseMainnetConfig],
          })
        } catch (addError) {
          console.error('Failed to add Base network:', addError)
          alert('Failed to add Base network to MetaMask')
        }
      } else {
        console.error('Failed to switch to Base network:', switchError)
        alert('Failed to switch to Base network')
      }
    }
  }

  const disconnectWallet = () => {
    setAddress(null)
    setIsConnected(false)
    setChainId(null)
    setBalance('0')
  }

  const getBalance = async () => {
    if (!address || !window.ethereum) return

    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      })
      setBalance(balance)
      return balance
    } catch (error) {
      console.error('Error getting balance:', error)
    }
  }

  // Listen for account changes
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined' && !isInFarcaster) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          setIsConnected(false)
          setAddress(null)
          setChainId(null)
        } else {
          setAddress(accounts[0])
          setIsConnected(true)
        }
      }

      const handleChainChanged = (chainId) => {
        setChainId(parseInt(chainId, 16))
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [isInFarcaster])

  // Get balance when address changes
  useEffect(() => {
    if (address && !isInFarcaster) {
      getBalance()
    }
  }, [address, isInFarcaster])

  return {
    isConnected,
    address,
    isLoading,
    chainId,
    balance,
    isInFarcaster,
    connectWallet,
    disconnectWallet,
    switchToBaseNetwork,
    getBalance
  }
}
