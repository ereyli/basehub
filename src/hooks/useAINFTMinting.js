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

  const { writeContract, data: hash, isPending, error: contractError } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

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
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Upload image and metadata to IPFS using Pinata
   * @param {string} prompt - Original prompt
   */
  const uploadToIPFS = async (prompt) => {
    if (!generatedImage) {
      setError('No image to upload');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Import new nftStorage utility (Pinata-based)
      const { uploadTokenMetadata } = await import('../utils/nftStorage');
      
      // Prepare token info
      const tokenInfo = {
        name: prompt ? `${prompt.substring(0, 50)}` : 'Uploaded Image NFT',
        description: prompt ? `AI-generated artwork: ${prompt}` : 'User uploaded image converted to NFT',
        attributes: [
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

    setIsMinting(true);
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
        await writeContract({
          address: AI_NFT_CONTRACT_ADDRESS,
          abi: AI_NFT_ABI,
          functionName: 'mintBatch',
          args: [address, uriToUse, BigInt(qty)],
          value: mintFee,
        });
      } else {
        console.log('🎨 Using single mint');
        await writeContract({
          address: AI_NFT_CONTRACT_ADDRESS,
          abi: AI_NFT_ABI,
          functionName: 'mintWithTokenURI',
          args: [address, uriToUse],
          value: mintFee,
        });
      }
      
    } catch (err) {
      console.error('❌ Error minting NFT:', err);
      setError(`Failed to mint NFT: ${err.message || err.toString()}`);
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

  // Update error state when contract error occurs
  React.useEffect(() => {
    if (contractError) {
      setError(`Contract error: ${contractError.message}`);
      setIsMinting(false);
    }
  }, [contractError]);

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
