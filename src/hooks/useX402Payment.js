// Hook for x402 payment using Coinbase Wallet SDK
// Only for x402 payment button - uses Coinbase Wallet exclusively
import { useState } from 'react'
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk'
import { createWalletClient, custom } from 'viem'
import { base } from 'viem/chains'
import { wrapFetchWithPayment } from 'x402-fetch'

export const useX402Payment = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [coinbaseWallet, setCoinbaseWallet] = useState(null)
  const [walletAddress, setWalletAddress] = useState(null)

  // Initialize Coinbase Wallet SDK
  const initializeCoinbaseWallet = () => {
    if (coinbaseWallet) return coinbaseWallet

    const sdk = new CoinbaseWalletSDK({
      appName: 'BaseHub',
      appLogoUrl: window.location.origin + '/icon.png',
      darkMode: false,
    })

    setCoinbaseWallet(sdk)
    return sdk
  }

  // Connect to Coinbase Wallet
  const connectCoinbaseWallet = async () => {
    try {
      const sdk = initializeCoinbaseWallet()
      const extension = sdk.makeWeb3Provider()
      
      // Request account access
      const accounts = await extension.request({
        method: 'eth_requestAccounts',
      })

      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0])
        return accounts[0]
      }

      throw new Error('No accounts found')
    } catch (err) {
      console.error('Coinbase Wallet connection error:', err)
      setError(err.message || 'Failed to connect Coinbase Wallet')
      throw err
    }
  }

  // Make x402 payment using Coinbase Wallet
  const makePayment = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Connect to Coinbase Wallet if not connected
      let address = walletAddress
      if (!address) {
        address = await connectCoinbaseWallet()
      }

      // Initialize SDK if needed
      const sdk = initializeCoinbaseWallet()
      const provider = sdk.makeWeb3Provider()

      // Get current account from provider
      const accounts = await provider.request({
        method: 'eth_accounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('Coinbase Wallet not connected')
      }

      const currentAddress = accounts[0]

      // Create viem wallet client from Coinbase Wallet provider
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
        account: currentAddress,
      })

      // Wait a bit to ensure wallet is ready
      await new Promise(resolve => setTimeout(resolve, 100))

      // Use x402-fetch to handle payment
      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        walletClient,
        BigInt(100000), // 0.1 USDC in base units (6 decimals: 0.1 * 10^6)
      )

      const response = await fetchWithPayment('/api/x402-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || 'Payment failed')
      }

      const result = await response.json()
      return result

    } catch (err) {
      console.error('x402 Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    makePayment,
    connectCoinbaseWallet,
    isLoading,
    error,
    walletAddress,
    isConnected: !!walletAddress,
  }
}

