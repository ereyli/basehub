import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useDeployERC721 } from '../hooks/useDeployERC721'
import { Image, Zap } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'

const DeployERC721 = () => {
  const { isConnected } = useAccount()
  const { deployERC721, isLoading, error } = useDeployERC721()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: ''
  })
  
  const [deployResult, setDeployResult] = useState(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }


  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const result = await deployERC721(
        formData.name,
        formData.symbol,
        null
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
        <BackButton />
        <h2 className="title">Deploy ERC721 Contract</h2>
        <p className="description">
          Deploy your own ERC721 NFT contract on the Base network. Define a name and symbol, and deploy your contract.
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
            <small style={{ color: '#9ca3af', fontSize: '12px' }}>
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
            <small style={{ color: '#9ca3af', fontSize: '12px' }}>
              Max 10 characters for Farcaster compatibility
            </small>
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

          {/* Share Button - More visible placement */}
          <div style={{ 
            marginTop: '24px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <ShareButton 
              title="Deploy ERC721 - BaseHub"
              description="Deploy your own ERC721 NFT contract on Base network"
              gameType="deploy"
              customUrl="https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub"
            />
          </div>

          <button 
            type="submit" 
            className="deploy-button"
            disabled={!isConnected || isLoading}
          >
            {isLoading ? 'Deploying ERC721 Contract...' : 'Deploy ERC721 Contract'}
          </button>
          
          {isLoading && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
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
