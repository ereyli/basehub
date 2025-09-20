import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useDeployERC721 } from '../hooks/useDeployERC721'
import { Image, Upload, X, Zap } from 'lucide-react'
import { Helmet } from 'react-helmet-async'

const DeployERC721 = () => {
  const { isConnected } = useAccount()
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
      setUploadedImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleRemoveImage = () => {
    setUploadedImage(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const result = await deployERC721(
        formData.name,
        formData.symbol,
        uploadedImage || null
      )
      
      setDeployResult(result)
    } catch (error) {
      console.error('Deploy failed:', error)
    }
  }

  return (
    <div className="deploy-nft-page">
      <Helmet>
        <title>Deploy ERC721 - BaseHub</title>
        <meta name="description" content="Deploy your own ERC721 NFT contract on Base network." />
      </Helmet>
      <div className="deploy-container">
        <h2 className="title">Deploy ERC721 Contract</h2>
        <p className="description">
          Deploy your own ERC721 NFT contract on the Base network. Upload an image, define a name and symbol, and deploy your contract.
        </p>

        <form onSubmit={handleSubmit} className="deploy-form">
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
            <label htmlFor="image">Collection Image (Optional)</label>
            <div className="image-upload-container">
              {!imagePreview ? (
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="image"
                    name="image"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="image" className="upload-button">
                    <Upload size={20} />
                    Upload Image
                  </label>
                  <p style={{ marginTop: '10px', fontSize: '14px', color: '#6b7280' }}>
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              ) : (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="NFT Preview" className="image-preview" />
                  <button type="button" onClick={handleRemoveImage} className="remove-image-button">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="deploy-info">
            <div className="info-item">
              <Zap size={16} />
              <span>Deploy Fee: 0.00007 ETH</span>
            </div>
            <div className="info-item">
              <Image size={16} />
              <span>ERC721 Standard</span>
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

          <button 
            type="submit" 
            className="deploy-button"
            disabled={!isConnected || isLoading}
          >
            {isLoading ? 'Deploying ERC721 Contract...' : 'Deploy ERC721 Contract'}
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

        {deployResult && (
          <div className="deploy-result">
            <h3>✅ ERC721 Contract Deployed!</h3>
            <p>
              **Contract Address:**{' '}
              <a 
                href={`https://basescan.org/address/${deployResult.contractAddress}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="link"
              >
                {deployResult.contractAddress}
              </a>
            </p>
            {deployResult.imageUrl && (
              <p>
                **Image URL (IPFS):**{' '}
                <a 
                  href={deployResult.imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="link"
                >
                  {deployResult.imageUrl}
                </a>
              </p>
            )}
            <p>
              **Metadata URL (IPFS):**{' '}
              <a 
                href={deployResult.metadataUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="link"
              >
                {deployResult.metadataUrl}
              </a>
            </p>
            <button onClick={() => navigate('/')} className="home-button">
              Go to Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeployERC721
