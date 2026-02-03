import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from 'wagmi'
import { parseEther, formatEther, formatUnits, parseUnits, decodeEventLog, maxUint256 } from 'viem'
import { NETWORKS } from '../config/networks'
import { supabase } from '../config/supabase'
import { addXP, recordTransaction } from '../utils/xpUtils'

// PumpHubFactory Contract ABI
const PUMPHUB_FACTORY_ABI = [
  {
    inputs: [
      { name: 'n', type: 'string' },
      { name: 's', type: 'string' },
      { name: 'd', type: 'string' },
      { name: 'img', type: 'string' },
      { name: 'a', type: 'uint256' }
    ],
    name: 'createToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 't', type: 'address' },
      { name: 'min', type: 'uint256' }
    ],
    name: 'buy',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 't', type: 'address' },
      { name: 'amt', type: 'uint256' },
      { name: 'min', type: 'uint256' }
    ],
    name: 'sell',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'claimFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'claimRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 't', type: 'address' },
      { name: 'e', type: 'uint256' }
    ],
    name: 'getTokensForETH',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 't', type: 'address' },
      { name: 'tok', type: 'uint256' }
    ],
    name: 'getETHForTokens',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'getPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'getMarketCap',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'getGraduationProgress',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getAllTokensCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'o', type: 'uint256' },
      { name: 'l', type: 'uint256' }
    ],
    name: 'getTokens',
    outputs: [{ name: 'r', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'getTokenMeta',
    outputs: [
      { name: '', type: 'string' },
      { name: '', type: 'string' },
      { name: '', type: 'string' },
      { name: '', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'getTokenStats',
    outputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getPlatformStats',
    outputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'tokenCore',
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'virtualETH', type: 'uint256' },
      { name: 'virtualTokens', type: 'uint256' },
      { name: 'realETH', type: 'uint256' },
      { name: 'creatorAllocation', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'uniswapPair', type: 'address' },
      { name: 'graduated', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 't', type: 'address' }],
    name: 'tokenStats',
    outputs: [
      { name: 'buys', type: 'uint256' },
      { name: 'sells', type: 'uint256' },
      { name: 'vol', type: 'uint256' },
      { name: 'holders', type: 'uint256' },
      { name: 'gradAt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'c', type: 'address' }],
    name: 'getCreatorTokens',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 't', type: 'address' },
      { indexed: true, name: 'c', type: 'address' },
      { indexed: false, name: 'n', type: 'string' },
      { indexed: false, name: 's', type: 'string' },
      { indexed: false, name: 'a', type: 'uint256' }
    ],
    name: 'TC',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 't', type: 'address' },
      { indexed: true, name: 'b', type: 'address' },
      { indexed: false, name: 'e', type: 'uint256' },
      { indexed: false, name: 'o', type: 'uint256' },
      { indexed: false, name: 'f', type: 'uint256' }
    ],
    name: 'TB',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 't', type: 'address' },
      { indexed: true, name: 's', type: 'address' },
      { indexed: false, name: 'i', type: 'uint256' },
      { indexed: false, name: 'o', type: 'uint256' },
      { indexed: false, name: 'f', type: 'uint256' }
    ],
    name: 'TS2',
    type: 'event'
  }
]

// ERC20 ABI for token balance
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
]

// PumpHubFactory Contract Address (Base Mainnet)
const PUMPHUB_FACTORY_ADDRESS = '0xE7c2Fe007C65349C91B8ccAC3c5BE5a7f2FDaF21'

export const usePumpHub = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const [error, setError] = useState(null)
  const [pendingTransaction, setPendingTransaction] = useState(null) // { type: 'create'|'buy'|'sell', data: {...} }
  const [pendingSellData, setPendingSellData] = useState(null) // { tokenAddress, tokenAmount, minETHOut } - for sell after approve
  const [approveHash, setApproveHash] = useState(null) // Hash of pending approve transaction
  const [currentHash, setCurrentHash] = useState(null) // Track current transaction hash
  const [lastCreatedToken, setLastCreatedToken] = useState(null) // Store last created token info { address, name, symbol, image, hash }
  
  // Use ref to prevent double popup - more reliable than state
  const isTransactionPendingRef = useRef(false)
  const lastErrorRef = useRef(null)

  const { writeContractAsync, isPending, error: writeError, reset: resetWrite } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({
    hash: currentHash,
  })

  // Separate hook for approve transaction confirmation
  const { data: approveReceipt, isSuccess: isApproveConfirmed, isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // NOTE: We intentionally don't use useEffect for writeError anymore
  // Error handling is done in catch blocks of each function
  // This prevents the double popup issue caused by useEffect re-triggers

  // Contract is always deployed
  const isContractDeployed = true

  // Save token to Supabase
  const saveTokenToSupabase = async (tokenAddress, tokenData) => {
    if (!supabase || !supabase.from) {
      console.warn('⚠️ Supabase not available, skipping token save')
      return
    }

    try {
      const { data, error } = await supabase
        .from('pumphub_tokens')
        .upsert({
          token_address: tokenAddress.toLowerCase(),
          creator: tokenData.creator?.toLowerCase() || address?.toLowerCase(),
          name: tokenData.name,
          symbol: tokenData.symbol,
          description: tokenData.description || '',
          image_uri: tokenData.imageUri || '',
          creator_allocation: tokenData.creatorAllocation || 0,
          virtual_eth: tokenData.virtualETH || '1',
          virtual_tokens: tokenData.virtualTokens || '800000000',
          real_eth: tokenData.realETH || '0',
          graduated: tokenData.graduated || false,
          uniswap_pair: tokenData.uniswapPair || null,
          market_cap: tokenData.marketCap || '0',
          price: tokenData.price || '0',
          progress: tokenData.progress || 0,
          total_buys: tokenData.totalBuys || 0,
          total_sells: tokenData.totalSells || 0,
          total_volume: tokenData.totalVolume || '0',
          holder_count: tokenData.holderCount || 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'token_address'
        })

      if (error) {
        console.error('❌ Error saving token to Supabase:', error)
      } else {
        console.log('✅ Token saved to Supabase:', tokenAddress)
      }
    } catch (err) {
      console.error('❌ Error in saveTokenToSupabase:', err)
    }
  }

  // Save trade to Supabase
  const saveTradeToSupabase = async (tradeData) => {
    if (!supabase || !supabase.from) {
      console.warn('⚠️ Supabase not available, skipping trade save')
      return
    }

    try {
      const { data, error } = await supabase
        .from('token_trades')
        .insert({
          token_address: tradeData.tokenAddress?.toLowerCase(),
          trader_address: tradeData.traderAddress?.toLowerCase(),
          trade_type: tradeData.tradeType, // 'buy' or 'sell'
          eth_amount: tradeData.ethAmount?.toString(),
          token_amount: tradeData.tokenAmount?.toString(),
          price: tradeData.price ? parseFloat(tradeData.price) : null,
          tx_hash: tradeData.txHash,
          block_number: tradeData.blockNumber ? BigInt(tradeData.blockNumber).toString() : null
        })

      if (error) {
        console.error('❌ Error saving trade to Supabase:', error)
      } else {
        console.log('✅ Trade saved to Supabase:', tradeData.txHash)
      }
    } catch (err) {
      console.error('❌ Error in saveTradeToSupabase:', err)
    }
  }

  // Create token
  const createToken = useCallback(async (name, symbol, description, imageUrl, creatorAllocation) => {
    if (!isConnected) {
      throw new Error('Please connect your wallet')
    }

    if (chainId !== NETWORKS.BASE.chainId) {
      throw new Error('Please switch to Base network')
    }

    // Prevent double popup using ref (more reliable)
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    try {
      setError(null)
      lastErrorRef.current = null
      isTransactionPendingRef.current = true
      
      const allocation = BigInt(Math.floor(creatorAllocation * 100)) // Convert percentage to basis points (0-1000 = 0-10%)
      const value = parseEther('0.001') // Minimum 0.001 ETH

      const hash = await writeContractAsync({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'createToken',
        args: [name, symbol, description || '', imageUrl || '', allocation],
        value
      })
      
      console.log('✅ Create token tx submitted:', hash)
      setCurrentHash(hash)
      return hash
    } catch (err) {
      isTransactionPendingRef.current = false
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsgLower = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsgLower.includes('user rejected') || 
                              errorMsgLower.includes('user denied') || 
                              errorMsgLower.includes('rejected the request') ||
                              errorMsgLower.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the create token transaction')
        setError(null)
        return null
      }
      
      console.error('❌ Create token failed:', err)
      const errorMsg = err.message || 'Failed to create token'
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }, [isConnected, chainId, writeContractAsync])

  // Process all transaction types when confirmed
  useEffect(() => {
    const processTransaction = async () => {
      if (!isConfirmed || !receipt || !currentHash || !address || !publicClient) return
      
      // Reset processing state when transaction is confirmed
      isTransactionPendingRef.current = false

      // Process all PumpHub events from logs
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: PUMPHUB_FACTORY_ABI,
            data: log.data,
            topics: log.topics
          })
          
          if (decoded.eventName === 'TC') {
            // Token creation event
            const tokenAddress = decoded.args.t
            console.log('✅ Token created:', tokenAddress)
            
            // Get token metadata from contract
            try {
              const tokenMeta = await publicClient.readContract({
                address: PUMPHUB_FACTORY_ADDRESS,
                abi: PUMPHUB_FACTORY_ABI,
                functionName: 'getTokenMeta',
                args: [tokenAddress]
              })
              
              // Save token to Supabase
              await saveTokenToSupabase(tokenAddress, {
                creator: address,
                name: tokenMeta[0] || '',
                symbol: tokenMeta[1] || '',
                description: tokenMeta[2] || '',
                imageUri: tokenMeta[3] || '',
                creatorAllocation: 0,
                virtualETH: '1',
                virtualTokens: '800000000',
                realETH: '0',
                graduated: false,
                marketCap: '0',
                price: '0',
                progress: 0,
                totalBuys: 0,
                totalSells: 0,
                totalVolume: '0',
                holderCount: 0
              })
              
              // Store created token info for success modal
              setLastCreatedToken({
                address: tokenAddress,
                name: tokenMeta[0] || '',
                symbol: tokenMeta[1] || '',
                image: tokenMeta[3] || '',
                hash: currentHash,
                createdAt: Date.now()
              })
              console.log('✅ Token created and saved:', tokenAddress)
              
              // Award XP for token creation (2000 XP)
              try {
                console.log('🎁 Awarding 2000 XP for token creation...')
                await addXP(address, 2000, 'PUMPHUB_TOKEN_CREATION')
                await recordTransaction(address, 'PUMPHUB_TOKEN_CREATION', 2000, currentHash)
                console.log('✅ XP awarded for token creation')
              } catch (xpError) {
                console.error('⚠️ Error awarding XP for token creation:', xpError)
              }
              
              // Update token stats
              setTimeout(() => {
                updateTokenStats(tokenAddress).catch(err => 
                  console.error('Error updating token stats after creation:', err)
                )
              }, 2000)
            } catch (metaError) {
              console.error('Error getting token metadata:', metaError)
            }
            break
          } else if (decoded.eventName === 'TB') {
            // Buy event
            const tokenAddress = decoded.args.t
            const ethAmount = decoded.args.e
            const tokenAmount = decoded.args.o
            
            await saveTradeToSupabase({
              tokenAddress,
              traderAddress: address,
              tradeType: 'buy',
              ethAmount: formatEther(ethAmount), // Convert wei to ETH string
              tokenAmount: formatUnits(tokenAmount, 18), // Convert wei to token string
              price: null,
              txHash: currentHash,
              blockNumber: receipt.blockNumber?.toString()
            })
            
            // Award XP for buy (100 XP)
            try {
              console.log('🎁 Awarding 100 XP for token buy...')
              await addXP(address, 100, 'PUMPHUB_BUY')
              await recordTransaction(address, 'PUMPHUB_BUY', 100, currentHash)
              console.log('✅ XP awarded for token buy')
            } catch (xpError) {
              console.error('⚠️ Error awarding XP for buy:', xpError)
            }
            
            setTimeout(() => {
              updateTokenStats(tokenAddress).catch(err => 
                console.error('Error updating token stats after buy:', err)
              )
            }, 2000)
            break
          } else if (decoded.eventName === 'TS2') {
            // Sell event
            const tokenAddress = decoded.args.t
            const tokenAmount = decoded.args.i
            const ethAmount = decoded.args.o
            
            await saveTradeToSupabase({
              tokenAddress,
              traderAddress: address,
              tradeType: 'sell',
              ethAmount: formatEther(ethAmount), // Convert wei to ETH string
              tokenAmount: formatUnits(tokenAmount, 18), // Convert wei to token string
              price: null,
              txHash: currentHash,
              blockNumber: receipt.blockNumber?.toString()
            })
            
            // Award XP for sell (100 XP)
            try {
              console.log('🎁 Awarding 100 XP for token sell...')
              await addXP(address, 100, 'PUMPHUB_SELL')
              await recordTransaction(address, 'PUMPHUB_SELL', 100, currentHash)
              console.log('✅ XP awarded for token sell')
            } catch (xpError) {
              console.error('⚠️ Error awarding XP for sell:', xpError)
            }
            
            setTimeout(() => {
              updateTokenStats(tokenAddress).catch(err => 
                console.error('Error updating token stats after sell:', err)
              )
            }, 2000)
            break
          }
        } catch (e) {
          // Not a PumpHub event, continue
          continue
        }
      }
    }

    processTransaction().catch(err => console.error('Error processing transaction:', err))
  }, [isConfirmed, receipt, currentHash, address, publicClient])

  // Buy tokens
  const buyTokens = useCallback(async (tokenAddress, ethAmount, minTokensOut = 0n) => {
    if (!isConnected) {
      throw new Error('Please connect your wallet')
    }

    if (chainId !== NETWORKS.BASE.chainId) {
      throw new Error('Please switch to Base network')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    try {
      setError(null)
      lastErrorRef.current = null
      isTransactionPendingRef.current = true
      
      const value = parseEther(ethAmount.toString())

      const hash = await writeContractAsync({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'buy',
        args: [tokenAddress, minTokensOut],
        value
      })
      
      console.log('✅ Buy tx submitted:', hash)
      setCurrentHash(hash)
      return hash
    } catch (err) {
      isTransactionPendingRef.current = false
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsgLower = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsgLower.includes('user rejected') || 
                              errorMsgLower.includes('user denied') || 
                              errorMsgLower.includes('rejected the request') ||
                              errorMsgLower.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the buy transaction')
        setError(null)
        return null
      }
      
      console.error('❌ Buy transaction failed:', err)
      const errorMsg = err.message || 'Failed to buy tokens'
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }, [isConnected, chainId, writeContractAsync])
  
  // Process buy transaction when confirmed
  useEffect(() => {
    const processBuy = async () => {
      if (!isConfirmed || !receipt || !currentHash || !address || !publicClient) return
      isTransactionPendingRef.current = false
      
      // Try to find TB event in logs
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: PUMPHUB_FACTORY_ABI,
            data: log.data,
            topics: log.topics
          })
          
          if (decoded.eventName === 'TB') {
            const tokenAddress = decoded.args.t
            const ethAmount = decoded.args.e
            const tokenAmount = decoded.args.o
            
            // Save trade to Supabase
            await saveTradeToSupabase({
              tokenAddress,
              traderAddress: address,
              tradeType: 'buy',
              ethAmount: formatEther(ethAmount), // Convert wei to ETH string
              tokenAmount: formatUnits(tokenAmount, 18), // Convert wei to token string
              price: null,
              txHash: currentHash,
              blockNumber: receipt.blockNumber?.toString()
            })
            
            // Update token stats
            setTimeout(() => {
              updateTokenStats(tokenAddress).catch(err => 
                console.error('Error updating token stats after buy:', err)
              )
            }, 2000)
            
            break
          }
        } catch (e) {
          continue
        }
      }
    }
    
    if (currentHash && receipt) {
      processBuy().catch(err => console.error('Error processing buy:', err))
    }
  }, [isConfirmed, receipt, currentHash, address, publicClient])
  
  // Process sell transaction when confirmed
  useEffect(() => {
    const processSell = async () => {
      if (!isConfirmed || !receipt || !currentHash || !address || !publicClient) return
      isTransactionPendingRef.current = false
      
      // Try to find TS2 event in logs
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: PUMPHUB_FACTORY_ABI,
            data: log.data,
            topics: log.topics
          })
          
          if (decoded.eventName === 'TS2') {
            const tokenAddress = decoded.args.t
            const tokenAmount = decoded.args.i
            const ethAmount = decoded.args.o
            
            // Save trade to Supabase
            await saveTradeToSupabase({
              tokenAddress,
              traderAddress: address,
              tradeType: 'sell',
              ethAmount: formatEther(ethAmount), // Convert wei to ETH string
              tokenAmount: formatUnits(tokenAmount, 18), // Convert wei to token string
              price: null,
              txHash: currentHash,
              blockNumber: receipt.blockNumber?.toString()
            })
            
            // Update token stats
            setTimeout(() => {
              updateTokenStats(tokenAddress).catch(err => 
                console.error('Error updating token stats after sell:', err)
              )
            }, 2000)
            
            break
          }
        } catch (e) {
          continue
        }
      }
    }
    
    if (currentHash && receipt) {
      processSell().catch(err => console.error('Error processing sell:', err))
    }
  }, [isConfirmed, receipt, currentHash, address, publicClient])

  // Sell tokens
  const sellTokens = useCallback(async (tokenAddress, tokenAmount, minETHOut = 0n) => {
    if (!isConnected) {
      throw new Error('Please connect your wallet')
    }

    if (chainId !== NETWORKS.BASE.chainId) {
      throw new Error('Please switch to Base network')
    }

    if (!publicClient || !address) {
      throw new Error('Public client or address not available')
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress, ignoring duplicate request')
      return null
    }

    try {
      setError(null)
      lastErrorRef.current = null
      isTransactionPendingRef.current = true
      
      // Convert token amount to wei (18 decimals)
      const amount = parseUnits(tokenAmount.toString(), 18)

      console.log('🔍 Checking token allowance...')
      
      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, PUMPHUB_FACTORY_ADDRESS]
      })

      console.log('Current allowance:', formatUnits(currentAllowance, 18))
      console.log('Required amount:', formatUnits(amount, 18))

      // If allowance is insufficient, approve first
      if (currentAllowance < amount) {
        console.log('⚠️ Insufficient allowance, approving tokens first...')
        
        // Save sell data for later execution after approve is confirmed
        setPendingSellData({ tokenAddress, tokenAmount, minETHOut })
        
        // Use maxUint256 for unlimited approval (like Uniswap)
        const maxApproval = maxUint256
        
        // Send approve transaction
        const approveHashResult = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PUMPHUB_FACTORY_ADDRESS, maxApproval]
        })

        console.log('✅ Approval transaction sent:', approveHashResult)
        setApproveHash(approveHashResult)
        
        // Don't proceed with sell yet - wait for approve confirmation
        return approveHashResult
      } else {
        console.log('✅ Sufficient allowance, proceeding with sell...')
        
        // Execute sell immediately if allowance is sufficient
        console.log('💰 Executing sell transaction...')
        const sellHash = await writeContractAsync({
          address: PUMPHUB_FACTORY_ADDRESS,
          abi: PUMPHUB_FACTORY_ABI,
          functionName: 'sell',
          args: [tokenAddress, amount, minETHOut]
        })
        
        console.log('✅ Sell tx submitted:', sellHash)
        setCurrentHash(sellHash)
        return sellHash
      }
    } catch (err) {
      isTransactionPendingRef.current = false
      
      // Check for user cancellation - case insensitive and multiple patterns
      const errorMsgLower = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsgLower.includes('user rejected') || 
                              errorMsgLower.includes('user denied') || 
                              errorMsgLower.includes('rejected the request') ||
                              errorMsgLower.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the sell transaction')
        setError(null)
        setPendingSellData(null)
        setApproveHash(null)
        return null
      }
      
      console.error('❌ Sell error:', err)
      const errorMsg = err.message || 'Failed to sell tokens'
      setError(errorMsg)
      // Clear pending sell data on error
      setPendingSellData(null)
      setApproveHash(null)
      throw new Error(errorMsg)
    }
  }, [isConnected, chainId, publicClient, address, writeContractAsync])

  // Execute sell after approve is confirmed
  useEffect(() => {
    const executeSellAfterApprove = async () => {
      if (isApproveConfirmed && approveReceipt && pendingSellData) {
        console.log('✅ Approve confirmed, now executing sell transaction...')
        
        const { tokenAddress, tokenAmount, minETHOut } = pendingSellData
        const amount = parseUnits(tokenAmount.toString(), 18)
        
        // Clear approve hash first to avoid conflicts
        setApproveHash(null)
        
        try {
          // Execute sell transaction
          const sellHash = await writeContractAsync({
            address: PUMPHUB_FACTORY_ADDRESS,
            abi: PUMPHUB_FACTORY_ABI,
            functionName: 'sell',
            args: [tokenAddress, amount, minETHOut]
          })
          
          console.log('✅ Sell tx submitted after approve:', sellHash)
          setCurrentHash(sellHash)
        } catch (err) {
          isTransactionPendingRef.current = false
          
          // Check for user cancellation
          const errorMsgLower = err.message?.toLowerCase() || ''
          const isUserRejection = errorMsgLower.includes('user rejected') || 
                                  errorMsgLower.includes('user denied') || 
                                  errorMsgLower.includes('rejected the request') ||
                                  errorMsgLower.includes('denied transaction') ||
                                  err.code === 4001
          
          if (isUserRejection) {
            console.log('ℹ️ User cancelled the sell transaction after approve')
          } else {
            console.error('❌ Sell error after approve:', err)
            setError(err.message || 'Failed to sell tokens')
          }
        }
        
        // Clear pending data
        setPendingSellData(null)
      }
    }
    
    executeSellAfterApprove()
  }, [isApproveConfirmed, approveReceipt, pendingSellData])

  // Claim fees (for creators)
  const claimFees = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Please connect your wallet')
    }

    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress')
      return null
    }

    try {
      setError(null)
      lastErrorRef.current = null
      isTransactionPendingRef.current = true
      
      const hash = await writeContractAsync({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'claimFees'
      })
      console.log('✅ Claim fees tx submitted:', hash)
      setCurrentHash(hash)
      return hash
    } catch (err) {
      isTransactionPendingRef.current = false
      
      // Check for user cancellation
      const errorMsgLower = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsgLower.includes('user rejected') || 
                              errorMsgLower.includes('user denied') || 
                              errorMsgLower.includes('rejected the request') ||
                              errorMsgLower.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the claim fees transaction')
        return null
      }
      
      console.error('❌ Claim fees failed:', err)
      const errorMsg = err.message || 'Failed to claim fees'
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }, [isConnected, writeContractAsync])

  // Claim refund
  const claimRefund = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Please connect your wallet')
    }

    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress')
      return null
    }

    try {
      setError(null)
      lastErrorRef.current = null
      isTransactionPendingRef.current = true
      
      const hash = await writeContractAsync({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'claimRefund'
      })
      console.log('✅ Claim refund tx submitted:', hash)
      setCurrentHash(hash)
      return hash
    } catch (err) {
      isTransactionPendingRef.current = false
      
      // Check for user cancellation
      const errorMsgLower = err.message?.toLowerCase() || ''
      const isUserRejection = errorMsgLower.includes('user rejected') || 
                              errorMsgLower.includes('user denied') || 
                              errorMsgLower.includes('rejected the request') ||
                              errorMsgLower.includes('denied transaction') ||
                              err.code === 4001
      
      if (isUserRejection) {
        console.log('ℹ️ User cancelled the claim refund transaction')
        return null
      }
      
      console.error('❌ Claim refund failed:', err)
      const errorMsg = err.message || 'Failed to claim refund'
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }, [isConnected, writeContractAsync])

  // Update token stats in Supabase (call this after trades to refresh data)
  const updateTokenStats = async (tokenAddress) => {
    if (!supabase || !supabase.from || !tokenAddress || !publicClient) return

    try {
      // Read current token data from contract
      const tokenCore = await publicClient.readContract({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'tokenCore',
        args: [tokenAddress]
      })

      const tokenStats = await publicClient.readContract({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'tokenStats',
        args: [tokenAddress]
      })

      const price = await publicClient.readContract({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'getPrice',
        args: [tokenAddress]
      })

      const marketCap = await publicClient.readContract({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'getMarketCap',
        args: [tokenAddress]
      })

      const graduationProgress = await publicClient.readContract({
        address: PUMPHUB_FACTORY_ADDRESS,
        abi: PUMPHUB_FACTORY_ABI,
        functionName: 'getGraduationProgress',
        args: [tokenAddress]
      })

      // Update Supabase
      await supabase
        .from('pumphub_tokens')
        .update({
          virtual_eth: formatEther(tokenCore[1] || 0n),
          virtual_tokens: formatUnits(tokenCore[2] || 0n, 18),
          real_eth: formatEther(tokenCore[3] || 0n),
          graduated: tokenCore[7] || false,
          uniswap_pair: tokenCore[6] || null,
          market_cap: marketCap ? formatEther(marketCap) : '0',
          price: price ? formatEther(price) : '0',
          progress: graduationProgress ? Number(graduationProgress) : 0,
          total_buys: tokenStats[0]?.toString() || '0',
          total_sells: tokenStats[1]?.toString() || '0',
          total_volume: formatEther(tokenStats[2] || 0n),
          holder_count: tokenStats[3]?.toString() || '0',
          updated_at: new Date().toISOString()
        })
        .eq('token_address', tokenAddress.toLowerCase())
    } catch (err) {
      console.error('Error updating token stats:', err)
    }
  }

  return {
    createToken,
    buyTokens,
    sellTokens,
    claimFees,
    claimRefund,
    isLoading: isPending || isConfirming,
    isSuccess: isConfirmed,
    error: error,
    hash: currentHash,
    isContractDeployed,
    contractAddress: PUMPHUB_FACTORY_ADDRESS,
    lastCreatedToken, // Last created token info for success modal
    clearLastCreatedToken: () => setLastCreatedToken(null), // Clear after showing modal
    saveTokenToSupabase, // Export for manual updates
    saveTradeToSupabase, // Export for manual updates
    updateTokenStats, // Export for updating token stats
    resetError: () => { 
      setError(null)
      lastErrorRef.current = null
      isTransactionPendingRef.current = false
    }
  }
}

// Hook for reading contract data
export const usePumpHubData = (tokenAddress = null) => {
  const { address } = useAccount()
  const chainId = useChainId()
  
  // PumpHubFactory Contract Address (Base Mainnet) - Updated
  const FACTORY_ADDRESS = '0xE7c2Fe007C65349C91B8ccAC3c5BE5a7f2FDaF21'
  const isContractDeployed = true

  // Platform stats
  const { data: platformStats } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'getPlatformStats',
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId }
  })

  // All tokens count
  const { data: totalTokens } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'getAllTokensCount',
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId }
  })

  // Token data (if tokenAddress provided)
  const { data: tokenCore } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'tokenCore',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId && !!tokenAddress }
  })

  const { data: tokenMeta } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'getTokenMeta',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId && !!tokenAddress }
  })

  const { data: tokenStats } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'getTokenStats',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId && !!tokenAddress }
  })

  const { data: price } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'getPrice',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId && !!tokenAddress }
  })

  const { data: marketCap } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'getMarketCap',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId && !!tokenAddress }
  })

  const { data: graduationProgress } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: PUMPHUB_FACTORY_ABI,
    functionName: 'getGraduationProgress',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: isContractDeployed && chainId === NETWORKS.BASE.chainId && !!tokenAddress }
  })

  // Token balance (if tokenAddress and user address provided)
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!tokenAddress && !!address && chainId === NETWORKS.BASE.chainId }
  })

  return {
    platformStats: platformStats ? {
      totalTokens: platformStats[0]?.toString(),
      totalGraduated: platformStats[1]?.toString(),
      totalVolume: formatEther(platformStats[2] || 0n)
    } : null,
    totalTokens: totalTokens?.toString(),
    tokenData: tokenCore ? {
      creator: tokenCore[0],
      virtualETH: formatEther(tokenCore[1] || 0n),
      virtualTokens: formatUnits(tokenCore[2] || 0n, 18),
      realETH: formatEther(tokenCore[3] || 0n),
      creatorAllocation: tokenCore[4]?.toString(),
      createdAt: tokenCore[5]?.toString(),
      uniswapPair: tokenCore[6],
      graduated: tokenCore[7]
    } : null,
    tokenMeta: tokenMeta ? {
      name: tokenMeta[0],
      symbol: tokenMeta[1],
      description: tokenMeta[2],
      image: tokenMeta[3]
    } : null,
    tokenStats: tokenStats ? {
      buys: tokenStats[0]?.toString(),
      sells: tokenStats[1]?.toString(),
      volume: formatEther(tokenStats[2] || 0n),
      holders: tokenStats[3]?.toString(),
      gradAt: tokenStats[4]?.toString()
    } : null,
    price: price ? formatEther(price) : null,
    marketCap: marketCap ? formatEther(marketCap) : null,
    graduationProgress: graduationProgress ? Number(graduationProgress) : null,
    tokenBalance: tokenBalance ? formatUnits(tokenBalance, 18) : null,
    isContractDeployed
  }
}
