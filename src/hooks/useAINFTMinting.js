import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { AI_NFT_CONFIG, getContractAddress, calculateMintFee, calculateMintFeeWei } from '../config/aiNFT';
import { addXP, recordTransaction } from '../utils/xpUtils';
import { useQuestSystem } from './useQuestSystem';

// AI Art Collection V2 Contract ABI (Tiered Pricing)
const AI_NFT_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "quantity",
        "type": "uint256"
      }
    ],
    "name": "previewFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "tokenURI_",
        "type": "string"
      }
    ],
    "name": "mintWithTokenURI",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "tokenURI_",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "quantity",
        "type": "uint256"
      }
    ],
    "name": "mintBatch",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contractURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// AI NFT Collection Contract Address (Base Mainnet)
// Bu adres deploy edildikten sonra güncellenecek
const AI_NFT_CONTRACT_ADDRESS = getContractAddress();

/**
 * Hook for AI NFT minting functionality
 * @param {number} quantity - Number of NFTs to mint
 * @returns {Object} - Minting state and functions
 */
export function useAINFTMinting(quantity = 1) {
  const { address } = useAccount();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [metadataURI, setMetadataURI] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Use ref to prevent double popup - more reliable than state
  const isTransactionPendingRef = React.useRef(false);
  const lastErrorRef = React.useRef(null);

  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // NOTE: We intentionally don't use useEffect for contractError anymore
  // Error handling is done in catch block of mintNFT function
  // This prevents the double popup issue caused by useEffect re-triggers

  /**
   * Generate AI image from prompt or uploaded image
   * @param {string} prompt - Text prompt for image generation
   * @param {string} uploadedImage - Optional uploaded image base64
   */
  const generateImage = async (prompt, uploadedImage = null) => {
    if (!prompt.trim() && !uploadedImage) {
      setError('Please enter a prompt or upload an image');
      return;
    }
    
    // For upload mode, prompt is optional (enhancement)
    if (uploadedImage && !prompt.trim()) {
      console.log('📸 Upload mode: No enhancement prompt provided, using original image');
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // Import AI image generator
      const { generateAIImage } = await import('../utils/aiImageGenerator');
      
      // Generate image
      const base64Image = await generateAIImage(prompt, uploadedImage);
      setGeneratedImage(base64Image);
      
    } catch (err) {
      console.error('Error generating image:', err);
      const errorMessage = err.message || '';
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        setError('Gemini API quota exceeded. Using canvas-based image generation instead. Your NFT will still be created!');
      } else {
        setError('Failed to generate image. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Determine category based on prompt content
   * @param {string} prompt - AI prompt text
   * @returns {string} Category name
   */
  const determineCategory = (prompt) => {
    if (!prompt) return 'General';
    
    const lowerPrompt = prompt.toLowerCase();
    
    // Animals category
    if (lowerPrompt.includes('dog') || lowerPrompt.includes('cat') || lowerPrompt.includes('animal') || 
        lowerPrompt.includes('pet') || lowerPrompt.includes('bird') || lowerPrompt.includes('fish') ||
        lowerPrompt.includes('horse') || lowerPrompt.includes('lion') || lowerPrompt.includes('tiger') ||
        lowerPrompt.includes('bear') || lowerPrompt.includes('wolf') || lowerPrompt.includes('elephant')) {
      return 'Animals';
    }
    
    // Nature category
    if (lowerPrompt.includes('winter') || lowerPrompt.includes('summer') || lowerPrompt.includes('spring') ||
        lowerPrompt.includes('autumn') || lowerPrompt.includes('forest') || lowerPrompt.includes('mountain') ||
        lowerPrompt.includes('ocean') || lowerPrompt.includes('river') || lowerPrompt.includes('lake') ||
        lowerPrompt.includes('tree') || lowerPrompt.includes('flower') || lowerPrompt.includes('garden') ||
        lowerPrompt.includes('landscape') || lowerPrompt.includes('sunset') || lowerPrompt.includes('sunrise')) {
      return 'Nature';
    }
    
    // Superheroes category
    if (lowerPrompt.includes('superhero') || lowerPrompt.includes('captain') || lowerPrompt.includes('spider') ||
        lowerPrompt.includes('batman') || lowerPrompt.includes('superman') || lowerPrompt.includes('iron man') ||
        lowerPrompt.includes('thor') || lowerPrompt.includes('hulk') || lowerPrompt.includes('wonder woman') ||
        lowerPrompt.includes('avengers') || lowerPrompt.includes('marvel') || lowerPrompt.includes('dc')) {
      return 'Superheroes';
    }
    
    // Vehicles category
    if (lowerPrompt.includes('car') || lowerPrompt.includes('truck') || lowerPrompt.includes('motorcycle') ||
        lowerPrompt.includes('bike') || lowerPrompt.includes('plane') || lowerPrompt.includes('boat') ||
        lowerPrompt.includes('ship') || lowerPrompt.includes('train') || lowerPrompt.includes('bus') ||
        lowerPrompt.includes('vehicle') || lowerPrompt.includes('automobile')) {
      return 'Vehicles';
    }
    
    // Technology category
    if (lowerPrompt.includes('robot') || lowerPrompt.includes('ai') || lowerPrompt.includes('computer') ||
        lowerPrompt.includes('tech') || lowerPrompt.includes('cyber') || lowerPrompt.includes('digital') ||
        lowerPrompt.includes('space') || lowerPrompt.includes('futuristic') || lowerPrompt.includes('sci-fi')) {
      return 'Technology';
    }
    
    // Art category
    if (lowerPrompt.includes('art') || lowerPrompt.includes('painting') || lowerPrompt.includes('drawing') ||
        lowerPrompt.includes('sketch') || lowerPrompt.includes('portrait') || lowerPrompt.includes('abstract') ||
        lowerPrompt.includes('modern') || lowerPrompt.includes('classic') || lowerPrompt.includes('vintage')) {
      return 'Art';
    }
    
    // Fantasy category
    if (lowerPrompt.includes('fantasy') || lowerPrompt.includes('magic') || lowerPrompt.includes('dragon') ||
        lowerPrompt.includes('wizard') || lowerPrompt.includes('fairy') || lowerPrompt.includes('castle') ||
        lowerPrompt.includes('medieval') || lowerPrompt.includes('mythical') || lowerPrompt.includes('legend')) {
      return 'Fantasy';
    }
    
    // Food category
    if (lowerPrompt.includes('food') || lowerPrompt.includes('pizza') || lowerPrompt.includes('burger') ||
        lowerPrompt.includes('cake') || lowerPrompt.includes('fruit') || lowerPrompt.includes('vegetable') ||
        lowerPrompt.includes('cooking') || lowerPrompt.includes('restaurant') || lowerPrompt.includes('meal')) {
      return 'Food';
    }
    
    // Sports category
    if (lowerPrompt.includes('sport') || lowerPrompt.includes('football') || lowerPrompt.includes('basketball') ||
        lowerPrompt.includes('soccer') || lowerPrompt.includes('tennis') || lowerPrompt.includes('golf') ||
        lowerPrompt.includes('baseball') || lowerPrompt.includes('hockey') || lowerPrompt.includes('swimming')) {
      return 'Sports';
    }
    
    // Default category
    return 'General';
  };

  /**
   * Upload image and metadata to IPFS using Pinata
   * @param {string} prompt - Original prompt
   * @param {object} customMetadata - Custom metadata object (optional)
   */
  const uploadToIPFS = async (prompt, customMetadata = null) => {
    if (!generatedImage) {
      setError('No image to upload');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Import new nftStorage utility (Pinata-based)
      const { uploadTokenMetadata } = await import('../utils/nftStorage');
      
      // Determine category based on prompt
      const category = determineCategory(prompt);
      
      // Prepare token info - use custom metadata if provided
      let tokenInfo;
      
      if (customMetadata && (customMetadata.name || customMetadata.description)) {
        // Use custom metadata
        tokenInfo = {
          name: customMetadata.name || (prompt ? `${prompt.substring(0, 50)}` : 'Uploaded Image NFT'),
          description: customMetadata.description || (prompt ? `AI-generated artwork: ${prompt}` : 'User uploaded image converted to NFT'),
          attributes: [
            {
              trait_type: 'Category',
              value: category
            },
            {
              trait_type: 'Type',
              value: prompt ? 'AI Generated' : 'User Uploaded'
            },
            {
              trait_type: 'Network',
              value: 'Base'
            },
            {
              trait_type: prompt ? 'Prompt Length' : 'Upload Type',
              value: prompt ? prompt.length.toString() : 'Direct Upload'
            }
          ],
          external_url: 'https://basehub.xyz'
        };
      } else {
        // Use default metadata
        tokenInfo = {
          name: prompt ? `${prompt.substring(0, 50)}` : 'Uploaded Image NFT',
          description: prompt ? `AI-generated artwork: ${prompt}` : 'User uploaded image converted to NFT',
          attributes: [
            {
              trait_type: 'Category',
              value: category
            },
            {
              trait_type: 'Type',
              value: prompt ? 'AI Generated' : 'User Uploaded'
            },
            {
              trait_type: 'Network',
              value: 'Base'
            },
            {
              trait_type: prompt ? 'Prompt Length' : 'Upload Type',
              value: prompt ? prompt.length.toString() : 'Direct Upload'
            }
          ],
          external_url: 'https://basehub.xyz'
        };
      }
      
      // Upload to Pinata and get metadata URI
      const metadataIPFSUrl = await uploadTokenMetadata(generatedImage, tokenInfo);
      
      setMetadataURI(metadataIPFSUrl);
      return metadataIPFSUrl;
      
    } catch (err) {
      console.error('Error uploading to IPFS:', err);
      setError(`Failed to upload to IPFS: ${err.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Mint NFT with the generated image and metadata (supports batch minting with tiered pricing)
   * @param {number} quantity - Number of NFTs to mint (default: 1, max: 10000)
   * @param {string} customMetadataURI - Optional metadata URI (uses state if not provided)
   */
  const mintNFT = async (quantity = 1, customMetadataURI = null) => {
    // Use provided URI or fall back to state
    const uriToUse = customMetadataURI || metadataURI;
    
    console.log('🔍 Mint check:', { 
      customMetadataURI, 
      metadataURI, 
      uriToUse,
      quantity 
    });
    
    if (!uriToUse) {
      setError('No metadata URI available. Please generate and upload an image first.');
      console.error('❌ No metadata URI available');
      return;
    }

    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    // Validate quantity (V2: max 10,000)
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 10000) {
      setError('Quantity must be between 1 and 10,000');
      return;
    }

    // Prevent double popup using ref
    if (isTransactionPendingRef.current) {
      console.log('⚠️ Transaction already in progress');
      return;
    }

    setIsMinting(true);
    lastErrorRef.current = null;
    isTransactionPendingRef.current = true;
    setError(null);

    try {
      // V2: Calculate tiered fee based on quantity (NOT qty * price)
      const feeInEth = calculateMintFee(qty);
      const mintFee = parseEther(feeInEth);
      
      console.log('💰 V2 Tiered fee for', qty, 'NFTs:', feeInEth, 'ETH');
      console.log('🎯 Contract address:', AI_NFT_CONTRACT_ADDRESS);
      console.log('📋 Metadata URI:', uriToUse);
      
      // Use batch minting if quantity > 1, otherwise single mint
      if (qty > 1) {
        console.log('🔄 Using batch mint for quantity:', qty);
        await writeContractAsync({
          address: AI_NFT_CONTRACT_ADDRESS,
          abi: AI_NFT_ABI,
          functionName: 'mintBatch',
          args: [address, uriToUse, BigInt(qty)],
          value: mintFee,
        });
      } else {
        console.log('🎨 Using single mint');
        await writeContractAsync({
          address: AI_NFT_CONTRACT_ADDRESS,
          abi: AI_NFT_ABI,
          functionName: 'mintWithTokenURI',
          args: [address, uriToUse],
          value: mintFee,
        });
      }
      
    } catch (err) {
      console.error('❌ Error minting NFT:', err);
      isTransactionPendingRef.current = false;
      // Don't show error for user cancellation
      if (err.message?.includes('User rejected') || err.message?.includes('user rejected')) {
        console.log('ℹ️ User cancelled the transaction');
        setError(null);
      } else {
        setError(`Failed to mint NFT: ${err.message || err.toString()}`);
      }
      setIsMinting(false);
    }
  };

  /**
   * Complete flow: generate image, upload to IPFS, and mint NFT
   * @param {string} prompt - Text prompt for image generation
   */
  const createAINFT = async (prompt) => {
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Generate image
      await generateImage(prompt);
      
      // Step 2: Upload to IPFS
      await uploadToIPFS(prompt);
      
      // Step 3: Mint NFT
      await mintNFT();
      
    } catch (err) {
      console.error('Error in complete flow:', err);
      setError('Failed to create AI NFT. Please try again.');
    }
  };

  /**
   * Reset all state
   */
  const reset = () => {
    setGeneratedImage(null);
    setMetadataURI(null);
    setError(null);
    setSuccess(null);
    setIsGenerating(false);
    setIsUploading(false);
    setIsMinting(false);
  };

  // Update success state when transaction is confirmed
  React.useEffect(() => {
    if (isConfirmed && hash) {
      setSuccess({
        message: 'AI NFT minted successfully!',
        transactionHash: hash,
        explorerUrl: `https://basescan.org/tx/${hash}`
      });
      setIsMinting(false);
      isTransactionPendingRef.current = false;
      
      // Award XP and update quest progress
      const awardXPAndUpdateQuests = async () => {
        try {
          console.log('🎉 Awarding 500 XP for AI NFT minting!');
          await addXP(address, 500, 'AI NFT Minting');
          
          // Record transaction
          await recordTransaction({
            wallet_address: address,
            game_type: 'AI NFT Minting',
            tx_hash: hash,
            xp_earned: 500,
            result: 'success',
            quantity: quantity
          });
          
          // Update quest progress
          const { updateQuestProgress } = useQuestSystem();
          await updateQuestProgress('nftMinted', 1);
          await updateQuestProgress('transactions', 1);
          
          console.log('✅ XP awarded, transaction recorded, and quest progress updated!');
        } catch (error) {
          console.error('❌ Failed to award XP or update quest progress:', error);
        }
      };
      
      awardXPAndUpdateQuests();
    }
  }, [isConfirmed, hash, address, quantity]);


  return {
    // State
    isGenerating,
    isUploading,
    isMinting: isMinting || isPending || isConfirming,
    generatedImage,
    metadataURI,
    error,
    success,
    transactionHash: hash,
    
    // Functions
    generateImage,
    uploadToIPFS,
    mintNFT,
    createAINFT,
    reset,
    
    // Contract info
    contractAddress: AI_NFT_CONTRACT_ADDRESS,
    calculateMintFee, // V2: Dynamic fee calculation
    
    // Helper for UI
    getMintFeeForQuantity: (qty) => calculateMintFee(qty)
  };
}
