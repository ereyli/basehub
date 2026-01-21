import React, { useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useDeployToken } from '../hooks/useDeployToken'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Coins, Zap, CheckCircle, ExternalLink } from 'lucide-react'
import EmbedMeta from '../components/EmbedMeta'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { getTransactionExplorerUrl } from '../config/networks'

const DeployToken = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { deployToken, isLoading, error } = useDeployToken()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    initialSupply: '',
    decimals: '18'
  })
  
  const [deployResult, setDeployResult] = useState(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleDeploy = async (e) => {
    e.preventDefault()
    
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const result = await deployToken(
        formData.name,
        formData.symbol,
        formData.initialSupply,
        parseInt(formData.decimals)
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
    <NetworkGuard showWarning={true}>
      <div className="deploy-token-page">
               <EmbedMeta 
                 title="Deploy Token - BaseHub"
                 description="Deploy your own ERC20 token on Base network"
                 buttonText="🪙 Deploy Token!"
                 image="/image.svg"
               />

      <div className="deploy-container">
        <BackButton />
        <div className="deploy-header">
          <div className="deploy-icon">
            <img src="/crypto-logos/basahub logo/ERC20.png" alt="Deploy Token" loading="lazy" style={{ width: '60px', height: '60px', borderRadius: '16px' }} />
          </div>
          <h1>Deploy Your Token</h1>
          <p>Create your own ERC20 token on Base network</p>
        </div>

        {!deployResult ? (
          <form onSubmit={handleDeploy} className="deploy-form">
            <div className="form-group">
              <label htmlFor="name">Token Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., My Token"
                maxLength="20"
                required
              />
              <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                Max 20 characters for Farcaster compatibility
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="symbol">Token Symbol</label>
              <input
                type="text"
                id="symbol"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                placeholder="e.g., MTK"
                maxLength="10"
                required
              />
              <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                Max 10 characters for Farcaster compatibility
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="initialSupply">Initial Supply</label>
              <input
                type="number"
                id="initialSupply"
                name="initialSupply"
                value={formData.initialSupply}
                onChange={handleInputChange}
                placeholder="e.g., 1000000"
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="decimals">Decimals</label>
              <select
                id="decimals"
                name="decimals"
                value={formData.decimals}
                onChange={handleInputChange}
              >
                <option value="18">18 (Standard)</option>
                <option value="6">6 (USDC style)</option>
                <option value="8">8 (BTC style)</option>
              </select>
            </div>

            <div className="deploy-info">
              <div className="info-item">
                <Zap size={16} />
                <span>Deploy Fee: 0.00005 ETH</span>
              </div>
              <div className="info-item">
                <Coins size={16} />
                <span>Network: Base Mainnet</span>
              </div>
              <div className="info-item">
                <Zap size={16} />
                <span>XP Reward: +50 XP</span>
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
                title="Deploy Token - BaseHub"
                description="Deploy your own ERC20 token on Base network"
                gameType="deploy"
                customUrl="https://farcaster.xyz/miniapps/t2NxuDgwJYsl/basehub"
              />
            </div>

            <button 
              type="submit" 
              className="deploy-button"
              disabled={!isConnected || isLoading}
            >
              {isLoading ? 'Deploying Token...' : 'Deploy Token'}
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
        ) : (
          <div className="deploy-success">
            <div className="success-icon">
              <CheckCircle size={48} />
            </div>
            <h2>Token Deployed Successfully!</h2>
            
            <div className="deploy-details">
              <div className="detail-item">
                <strong>Token Name:</strong> {formData.name}
              </div>
              <div className="detail-item">
                <strong>Symbol:</strong> {formData.symbol}
              </div>
              <div className="detail-item">
                <strong>Initial Supply:</strong> {formData.initialSupply} {formData.symbol}
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
                  setFormData({ name: '', symbol: '', initialSupply: '', decimals: '18' })
                }}
                className="deploy-another-button"
              >
                Deploy Another Token
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
    </NetworkGuard>
  )
}

export default DeployToken
