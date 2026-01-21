import React, { useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useDeployERC721 } from '../hooks/useDeployERC721'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Image, Zap, CheckCircle, ExternalLink, Upload, X } from 'lucide-react'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import { getTransactionExplorerUrl } from '../config/networks'

const DeployNFT = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { deployERC721, isLoading, error } = useDeployERC721()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: ''
  })
  
  const [deployResult, setDeployResult] = useState(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB')
        return
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      setUploadedImage(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setUploadedImage(null)
    setImagePreview(null)
  }

  const handleDeploy = async (e) => {
    e.preventDefault()
    
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    if (!uploadedImage) {
      alert('Please upload an image for your NFT collection')
      return
    }

    try {
      const result = await deployERC721(
        formData.name,
        formData.symbol,
        uploadedImage
      )
      
      setDeployResult(result)
    } catch (error) {
      console.error('Deploy failed:', error)
    }
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="deploy-nft-page">
        <EmbedMeta 
          title="Deploy NFT Collection - BaseHub"
          description="Deploy your own NFT collection on Base network"
          buttonText="🖼️ Deploy NFT!"
          image="/image.svg"
        />

      <div className="deploy-container">
        <BackButton />
        <div className="deploy-header">
          <div className="deploy-icon">
            <Image size={32} />
          </div>
          <h1>Deploy Your NFT Collection</h1>
          <p>Create your own NFT collection on Base network</p>
        </div>

        {!deployResult ? (
          <form onSubmit={handleDeploy} className="deploy-form">
            <div className="form-group">
              <label htmlFor="name">Collection Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., My Awesome NFTs"
                maxLength="20"
                required
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                Max 20 characters for Farcaster compatibility
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="symbol">Collection Symbol</label>
              <input
                type="text"
                id="symbol"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                placeholder="e.g., MAN"
                maxLength="10"
                required
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                Max 10 characters for Farcaster compatibility
              </small>
            </div>


            <div className="form-group">
              <label htmlFor="image">Collection Image</label>
              <div className="image-upload-container">
                {!imagePreview ? (
                  <div className="image-upload-area">
                    <input
                      type="file"
                      id="image"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="image" className="upload-button">
                      <Upload size={24} />
                      <span>Upload Image</span>
                    </label>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '8px' }}>
                      Max 5MB, JPG/PNG/GIF supported
                    </p>
                  </div>
                ) : (
                  <div className="image-preview-container">
                    <img src={imagePreview} alt="Preview" className="image-preview" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="remove-image-button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="deploy-info">
              <div className="info-item">
                <Image size={16} />
                <span>Simple NFT Contract</span>
              </div>
              <div className="info-item">
                <Zap size={16} />
                <span>XP Reward: +100 XP</span>
              </div>
            </div>

            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}

            {/* Share Button - More visible placement */}
            <div style={{ 
              marginTop: '24px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <ShareButton 
                title="Deploy NFT Collection - BaseHub"
                description="Deploy your own NFT collection on Base network"
                gameType="deploy"
                customUrl="https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub"
              />
            </div>

            <button 
              type="submit" 
              className="deploy-button"
              disabled={!isConnected || isLoading || !uploadedImage}
            >
              {isLoading ? 'Deploying NFT Collection...' : 'Deploy NFT Collection'}
            </button>
            
            {isLoading && (
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #0ea5e9',
                color: '#0369a1',
                padding: '12px 16px',
                borderRadius: '8px',
                marginTop: '16px',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                ⏳ Please confirm the transaction in your wallet. This may take a few moments...
              </div>
            )}
          </form>
        ) : (
          <div className="deploy-success">
            <div className="success-icon">
              <CheckCircle size={48} />
            </div>
            <h2>NFT Collection Deployed Successfully!</h2>
            
            <div className="deploy-details">
              <div className="detail-item">
                <strong>Collection Name:</strong> {formData.name}
              </div>
              <div className="detail-item">
                <strong>Symbol:</strong> {formData.symbol}
              </div>
              <div className="detail-item">
                <strong>Max Supply:</strong> {formData.maxSupply} NFTs
              </div>
              <div className="detail-item">
                <strong>Mint Price:</strong> {formData.mintPrice} ETH
              </div>
              <div className="detail-item">
                <strong>Status:</strong>
                <div className="status-message">
                  {deployResult.status || 'Fee paid successfully!'}
                </div>
              </div>
              {deployResult.xpEarned && (
                <div className="detail-item">
                  <strong>XP Earned:</strong>
                  <div className="status-message" style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }}>
                    🎉 +{deployResult.xpEarned} XP earned!
                  </div>
                </div>
              )}
              <div className="detail-item">
                <strong>Fee Transaction:</strong>
                <div className="tx-hash">
                  {formatAddress(deployResult.txHash)}
                  <a 
                    href={getTransactionExplorerUrl(chainId, deployResult.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-button"
                  >
                    <ExternalLink size={14} />
                    View
                  </a>
                </div>
              </div>
              {deployResult.contractAddress && (
                <div className="detail-item">
                  <strong>Contract Address:</strong>
                  <div className="contract-address">
                    {formatAddress(deployResult.contractAddress)}
                    <button 
                      onClick={() => navigator.clipboard.writeText(deployResult.contractAddress)}
                      className="copy-button"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="success-actions">
              <button 
                onClick={() => {
                  setDeployResult(null)
                  setFormData({ name: '', symbol: '', baseTokenURI: '', maxSupply: '', mintPrice: '' })
                  setUploadedImage(null)
                  setImagePreview(null)
                }}
                className="deploy-another-button"
              >
                Deploy Another Collection
              </button>
              <button 
                onClick={() => navigate('/')}
                className="home-button"
              >
                Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeployNFT
