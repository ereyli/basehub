import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  Sparkles, 
  Wand2,
  Coins,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { useAINFTMinting } from '../hooks/useAINFTMinting';
import BackButton from '../components/BackButton';
import ShareButton from '../components/ShareButton';
import NetworkGuard from '../components/NetworkGuard';

export default function AINFTLaunchpad() {
  const { address, isConnected } = useAccount();
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [currentFee, setCurrentFee] = useState('0.001');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageMode, setImageMode] = useState('prompt'); // 'prompt' or 'upload'
  
  // Custom metadata fields
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [useCustomMetadata, setUseCustomMetadata] = useState(false);
  
  const {
    isGenerating,
    isUploading,
    isMinting,
    generatedImage,
    metadataURI,
    error,
    success,
    transactionHash,
    generateImage,
    uploadToIPFS,
    mintNFT,
    reset,
    contractAddress,
    getMintFeeForQuantity
  } = useAINFTMinting(quantity);

  const handleGenerateImage = async (e) => {
    e.preventDefault();
    if (imageMode === 'prompt' && !currentPrompt.trim()) return;
    if (imageMode === 'upload' && !uploadedImage) return;
    
    // Validate prompt length for text mode
    if (imageMode === 'prompt' && currentPrompt.trim().length < 10) {
      alert('Please enter a more detailed prompt (at least 10 characters). Short prompts often produce poor results.');
      return;
    }
    
    // For upload mode, use empty prompt since we don't need description
    const promptToUse = imageMode === 'upload' ? '' : currentPrompt;
    await generateImage(promptToUse, uploadedImage);
  };

  // Debug: Log when image changes
  useEffect(() => {
    if (generatedImage) {
      console.log('🖼️ Generated image type:', typeof generatedImage);
      console.log('🖼️ Image starts with:', generatedImage.substring(0, 50));
      console.log('🖼️ Image length:', generatedImage.length);
    }
  }, [generatedImage]);

  // Handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // No file size limit - let Pinata handle it
    // Just show warning for large files

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
      setImageMode('upload');
    };
    reader.readAsDataURL(file);
  };

  // Remove uploaded image
  const removeUploadedImage = () => {
    setUploadedImage(null);
    setImageMode('prompt');
  };


  const handleMintNFT = async () => {
    if (generatedImage && (currentPrompt || imageMode === 'upload')) {
      let currentMetadataURI = metadataURI;
      if (!currentMetadataURI) {
        // Prepare custom metadata if user provided it
        let customMetadata = null;
        if (useCustomMetadata) {
          customMetadata = {
            name: customName || undefined,
            description: customDescription || undefined
          };
        }
        
        currentMetadataURI = await uploadToIPFS(currentPrompt, customMetadata);
        if (!currentMetadataURI) return;
      }
      await mintNFT(quantity, currentMetadataURI);
    }
  };

  const handleQuantityChange = (newQty) => {
    const qty = Math.max(1, Math.min(10000, parseInt(newQty) || 1));
    setQuantity(qty);
    setCurrentFee(getMintFeeForQuantity(qty));
  };

  const getTierName = () => {
    if (quantity <= 1000) return 'Tier 1';
    if (quantity <= 2000) return 'Tier 2';
    if (quantity <= 4000) return 'Tier 3';
    if (quantity <= 8000) return 'Tier 4';
    return 'Tier 5';
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <NetworkGuard showWarning={true}>
      <div className="deploy-token-page">
        <div className="deploy-container">
          <BackButton />
          
          {/* Header */}
          <div className="deploy-header">
            <div className="deploy-icon">
              <Sparkles size={32} />
            </div>
            <h1>AI NFT Launchpad</h1>
            <p>Create unique AI artwork and mint as NFT on Base</p>
          </div>

          {!success ? (
            <>
              {/* Mode Selection */}
              <div className="form-group">
                <label>Choose Creation Mode</label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setImageMode('prompt');
                      setUploadedImage(null);
                      setCurrentPrompt('');
                      setCustomName('');
                      setCustomDescription('');
                      setUseCustomMetadata(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: `2px solid ${imageMode === 'prompt' ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '12px',
                      background: imageMode === 'prompt' ? '#eff6ff' : '#ffffff',
                      color: imageMode === 'prompt' ? '#1d4ed8' : '#6b7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    <Wand2 size={16} />
                    AI Text Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageMode('upload');
                      setCurrentPrompt('');
                      setCustomName('');
                      setCustomDescription('');
                      setUseCustomMetadata(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: `2px solid ${imageMode === 'upload' ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '12px',
                      background: imageMode === 'upload' ? '#eff6ff' : '#ffffff',
                      color: imageMode === 'upload' ? '#1d4ed8' : '#6b7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    <Upload size={16} />
                    Upload Image
                  </button>
                </div>
              </div>

              {/* Generate Form */}
              <form onSubmit={handleGenerateImage} className="deploy-form">
                {imageMode === 'prompt' ? (
                  <div className="form-group">
                    <label htmlFor="prompt">Describe Your AI Art</label>
                  <textarea
                    id="prompt"
                    value={currentPrompt}
                    onChange={(e) => setCurrentPrompt(e.target.value)}
                    placeholder="Be specific and detailed: e.g., 'a majestic golden eagle soaring over snowy mountain peaks at sunset, photorealistic style'"
                    style={{
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      fontSize: '14px',
                      minHeight: '100px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                    maxLength="500"
                    disabled={isGenerating || !isConnected}
                    required
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    💡 Be specific and detailed (min 10 chars): include style, colors, mood, composition, lighting
                  </small>
                </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="image-upload">Upload Your Image</label>
                    <div
                      style={{
                        border: '2px dashed #d1d5db',
                        borderRadius: '12px',
                        padding: '24px',
                        textAlign: 'center',
                        background: '#f9fafb',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => document.getElementById('image-upload').click()}
                    >
                      {uploadedImage ? (
                        <div style={{ position: 'relative' }}>
                          <img
                            src={uploadedImage}
                            alt="Uploaded"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '200px',
                              borderRadius: '8px',
                              marginBottom: '12px'
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUploadedImage();
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'rgba(0,0,0,0.7)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Upload size={32} style={{ color: '#9ca3af', marginBottom: '8px' }} />
                          <p style={{ color: '#6b7280', margin: '0 0 4px 0' }}>
                            Click to upload image
                          </p>
                          <p style={{ color: '#9ca3af', fontSize: '12px', margin: '0' }}>
                            PNG, JPG, GIF (any size)
                          </p>
                          <p style={{ color: '#f59e0b', fontSize: '11px', margin: '4px 0 0 0', fontWeight: '500' }}>
                            ⚠️ 1MB+ images may upload slowly, smaller files recommended
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}

                        <button 
                          type="submit" 
                          className="deploy-button"
                          disabled={
                            (imageMode === 'prompt' && !currentPrompt.trim()) ||
                            (imageMode === 'upload' && !uploadedImage) ||
                            isGenerating || 
                            !isConnected
                          }
                        >
                  {isGenerating ? (
                    <>
                      <Wand2 size={20} className="animate-spin" />
                      {imageMode === 'upload' ? 'Preparing...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Wand2 size={20} />
                      {imageMode === 'upload' ? 'Create NFT' : 'Generate Artwork'}
                    </>
                  )}
                </button>
              </form>

              {/* Generated Image Preview */}
              {generatedImage && (
                <div style={{ marginTop: '32px' }}>
                  <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    border: '2px solid #e5e7eb'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        margin: 0
                      }}>
                        <Sparkles size={20} />
                        Your Artwork
                      </h3>
                      
                      <button 
                        onClick={() => {
                          setCurrentPrompt('');
                          setQuantity(1);
                          setCurrentFee('0.001');
                          setUploadedImage(null);
                          setImageMode('prompt');
                          setCustomName('');
                          setCustomDescription('');
                          setUseCustomMetadata(false);
                          reset();
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.transform = 'translateY(-1px)';
                          e.target.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)';
                        }}
                      >
                        <X size={14} />
                        Start Over
                      </button>
                    </div>
                    
                    <div style={{
                      width: '100%',
                      margin: '0 auto 24px',
                      padding: '20px',
                      background: '#f0f9ff',
                      borderRadius: '12px',
                      border: '2px solid #3b82f6',
                      minHeight: '400px'
                    }}>
                      {generatedImage ? (
                        <>
                          <img 
                            src={generatedImage} 
                            alt="Generated artwork"
                            style={{
                              width: '100%',
                              maxWidth: '600px',
                              minHeight: '300px',
                              height: 'auto',
                              borderRadius: '8px',
                              display: 'block',
                              margin: '0 auto',
                              objectFit: 'contain',
                              backgroundColor: '#ffffff'
                            }}
                            onError={(e) => {
                              console.error('❌ Image failed to render');
                              console.log('Image src length:', generatedImage?.length);
                              console.log('Image src preview:', generatedImage?.substring(0, 100));
                            }}
                            onLoad={() => {
                              console.log('✅ Image loaded successfully!');
                            }}
                          />
                          <div style={{ 
                            marginTop: '10px', 
                            fontSize: '11px', 
                            color: '#64748b',
                            textAlign: 'center',
                            wordBreak: 'break-all'
                          }}>
                            Image format: {generatedImage?.substring(0, 30)}...
                          </div>
                        </>
                      ) : (
                        <div style={{ 
                          padding: '40px', 
                          textAlign: 'center',
                          color: '#64748b' 
                        }}>
                          <p>⚠️ Image data is empty</p>
                          <small style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                            Debug: {JSON.stringify({ hasImage: !!generatedImage, type: typeof generatedImage })}
                          </small>
                        </div>
                      )}
                    </div>

                    {/* Mint Controls */}
                    <div className="deploy-form">
                      <div className="form-group">
                        <label htmlFor="quantity">Supply</label>
                        <input
                          type="number"
                          id="quantity"
                          min="1"
                          max="10000"
                          value={quantity}
                          onChange={(e) => handleQuantityChange(e.target.value)}
                          required
                        />
                        <small style={{ color: '#6b7280', fontSize: '12px' }}>
                          {getTierName()}: {currentFee} ETH per transaction
                        </small>
                      </div>

                      {/* Custom Metadata Section */}
                      <div className="form-group">
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <input
                            type="checkbox"
                            id="useCustomMetadata"
                            checked={useCustomMetadata}
                            onChange={(e) => setUseCustomMetadata(e.target.checked)}
                            style={{ margin: 0 }}
                          />
                          <label htmlFor="useCustomMetadata" style={{ 
                            margin: 0, 
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                          }}>
                            Use Custom Metadata (Optional)
                          </label>
                        </div>
                        
                        {useCustomMetadata && (
                          <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '16px',
                            marginTop: '8px'
                          }}>
                            <div style={{ marginBottom: '12px' }}>
                              <label htmlFor="customName" style={{ 
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#6b7280',
                                marginBottom: '4px'
                              }}>
                                NFT Name
                              </label>
                              <input
                                type="text"
                                id="customName"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder={imageMode === 'prompt' ? 'AI Generated Art' : 'My Uploaded NFT'}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            
                            <div style={{ marginBottom: '12px' }}>
                              <label htmlFor="customDescription" style={{ 
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#6b7280',
                                marginBottom: '4px'
                              }}>
                                Description
                              </label>
                              <textarea
                                id="customDescription"
                                value={customDescription}
                                onChange={(e) => setCustomDescription(e.target.value)}
                                placeholder={imageMode === 'prompt' ? 'AI-generated artwork created with BaseHub' : 'User uploaded image converted to NFT'}
                                rows={3}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  resize: 'vertical'
                                }}
                              />
                            </div>
                            
                          </div>
                        )}
                      </div>

                      <div className="deploy-info">
                        <div className="info-item">
                          <Coins size={16} />
                          <span>Minting Fee: {currentFee} ETH</span>
                        </div>
                        <div className="info-item">
                          <Sparkles size={16} />
                          <span>Network: Base Mainnet</span>
                        </div>
                      </div>

                      {error && (
                        <div className="error-message">
                          ❌ {error}
                        </div>
                      )}

                      <button 
                        onClick={handleMintNFT}
                        className="deploy-button"
                        disabled={isMinting || isUploading || !isConnected}
                      >
                        {isMinting || isUploading ? (
                          <>
                            <Coins size={20} className="animate-spin" />
                            {isUploading ? 'Uploading to IPFS...' : 'Minting...'}
                          </>
                        ) : (
                          <>
                            <Coins size={20} />
                            Mint {quantity} NFT{quantity > 1 ? 's' : ''} for {currentFee} ETH
                          </>
                        )}
                      </button>


                      {/* Share Button */}
                      <div style={{ 
                        marginTop: '24px',
                        display: 'flex',
                        justifyContent: 'center'
                      }}>
                        <ShareButton 
                          title="AI NFT Launchpad - BaseHub"
                          description="Generate AI art and mint as NFT on Base network"
                          gameType="nft"
                          customUrl="https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub"
                        />
                      </div>

                      {/* OpenSea Collection Link */}
                      <div style={{ 
                        marginTop: '20px',
                        display: 'flex',
                        justifyContent: 'center'
                      }}>
                        <a
                          href="https://opensea.io/collection/ai-132443724"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                          }}
                        >
                          <ExternalLink size={16} />
                          View Collection on OpenSea
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Tiers */}
                  <div style={{
                    marginTop: '24px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#475569',
                      marginBottom: '12px',
                      textAlign: 'center'
                    }}>
                      Pricing Tiers
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[
                        { range: '1-1,000 NFTs', price: '0.001 ETH', active: quantity <= 1000 },
                        { range: '1,001-2,000 NFTs', price: '0.002 ETH', active: quantity > 1000 && quantity <= 2000 },
                        { range: '2,001-4,000 NFTs', price: '0.004 ETH', active: quantity > 2000 && quantity <= 4000 },
                        { range: '4,001-8,000 NFTs', price: '0.008 ETH', active: quantity > 4000 && quantity <= 8000 },
                        { range: '8,001-10,000 NFTs', price: '0.01 ETH', active: quantity > 8000 }
                      ].map((tier, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: tier.active ? '#e2e8f0' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        >
                          <span style={{ color: '#475569', fontWeight: tier.active ? '600' : '400' }}>
                            {tier.range}
                          </span>
                          <span style={{ color: '#475569', fontWeight: '600' }}>
                            {tier.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="deploy-success">
              <div className="success-icon">
                <CheckCircle size={48} />
              </div>
              <h2>NFT Minted Successfully!</h2>
              
              <div className="deploy-details">
                <div className="detail-item">
                  <strong>Quantity:</strong> {quantity} NFT{quantity > 1 ? 's' : ''}
                </div>
                <div className="detail-item">
                  <strong>Minting Fee:</strong> {currentFee} ETH
                </div>
                <div className="detail-item">
                  <strong>Network:</strong> Base Mainnet
                </div>
                <div className="detail-item">
                  <strong>Transaction:</strong>
                  <div className="tx-hash">
                    {formatAddress(transactionHash)}
                    <a 
                      href={`https://basescan.org/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-button"
                    >
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
                <div className="detail-item">
                  <strong>Contract:</strong>
                  <div className="tx-hash">
                    {formatAddress(contractAddress)}
                    <a 
                      href={`https://basescan.org/address/${contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-button"
                    >
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
              </div>

              <div className="success-actions">
                <button 
                  onClick={() => {
                    setCurrentPrompt('');
                    setQuantity(1);
                    setCurrentFee('0.001');
                    reset();
                  }}
                  className="deploy-another-button"
                >
                  Create Another NFT
                </button>
                
                <a
                  href="https://opensea.io/collection/ai-132443724"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    marginTop: '12px'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  <ExternalLink size={16} />
                  View Your NFT on OpenSea
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </NetworkGuard>
  );
}
