import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { useDeployERC1155 } from '../hooks/useDeployERC1155'
import { Layers, Zap, CheckCircle, ExternalLink } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import { getTransactionExplorerUrl, getAddressExplorerUrl } from '../config/networks'

const DeployERC1155 = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { deployERC1155, isLoading, error } = useDeployERC1155()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: ''
  })
  
  const [deployResult, setDeployResult] = useState(null)

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // ERC1155 doesn't need image upload - uses URI system

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const result = await deployERC1155(
        formData.name,
        formData.symbol,
        '' // Empty URI
      )
      
      setDeployResult(result)
    } catch (error) {
      console.error('Deploy failed:', error)
    }
  }

  return (
    <div className="deploy-nft-page">
            <Helmet>
              <title>Deploy ERC1155 - BaseHub</title>
              <meta name="description" content="Deploy your own ERC1155 multi-token contract on Base network." />
            </Helmet>
            
      <div className="deploy-container">
        <BackButton />
        <h2 className="title">Deploy ERC1155 Contract</h2>
        <p className="description">
          Deploy your own ERC1155 multi-token contract on the Base network. Define a name and symbol, and deploy your contract.
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
              placeholder="e.g., My Multi-Token Collection"
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
              placeholder="e.g., MTC"
              maxLength="10"
              required
            />
            <small style={{ color: '#9ca3af', fontSize: '12px' }}>
              Max 10 characters for Farcaster compatibility
            </small>
          </div>



          <div className="deploy-info">
            <div className="info-item">
              <Layers size={16} />
              <span>ERC1155 Standard</span>
            </div>
            <div className="info-item">
              <Zap size={16} />
              <span>XP Reward: +850 XP</span>
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
              title="Deploy ERC1155 - BaseHub"
              description="Deploy your own ERC1155 multi-token contract on Base network"
              gameType="deploy"
              customUrl="https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub"
            />
          </div>

          <button 
            type="submit" 
            className="deploy-button"
            disabled={!isConnected || isLoading}
          >
            {isLoading ? 'Deploying ERC1155 Contract...' : 'Deploy ERC1155 Contract'}
          </button>
          
          {isLoading && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#9ca3af',
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
          <div className="deploy-success">
            <div className="success-icon">
              <CheckCircle size={48} />
            </div>
            <h2>ERC1155 Contract Deployed Successfully!</h2>
            
            <div className="deploy-details">
              <div className="detail-item">
                <strong>Collection Name:</strong> {formData.name}
              </div>
              <div className="detail-item">
                <strong>Symbol:</strong> {formData.symbol}
              </div>
              {deployResult.contractAddress && (
                <div className="detail-item">
                  <strong>Contract Address:</strong>
                  <div className="tx-hash">
                    {formatAddress(deployResult.contractAddress)}
                    <a 
                      href={getAddressExplorerUrl(chainId, deployResult.contractAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-button"
                    >
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
              )}
              {deployResult.deployTxHash && (
                <div className="detail-item">
                  <strong>Deployment Transaction:</strong>
                  <div className="tx-hash">
                    {formatAddress(deployResult.deployTxHash)}
                    <a 
                      href={getTransactionExplorerUrl(chainId, deployResult.deployTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-button"
                    >
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="success-actions">
              <button 
                onClick={() => {
                  setDeployResult(null)
                  setFormData({ name: '', symbol: '' })
                }}
                className="deploy-another-button"
              >
                Deploy Another Contract
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

export default DeployERC1155
