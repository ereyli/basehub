import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { Bot, CheckCircle, ExternalLink, Image as ImageIcon, Network, Upload, Users, Zap } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import BackButton from '../components/BackButton'
import ShareButton from '../components/ShareButton'
import NetworkGuard from '../components/NetworkGuard'
import { useDeployERC8004 } from '../hooks/useDeployERC8004'
import { ERC8004_AGENT_XP_REWARD } from '../config/erc8004'
import { getAddressExplorerUrl, getTransactionExplorerUrl } from '../config/networks'

const DeployERC8004 = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const navigate = useNavigate()
  const {
    deployERC8004Agent,
    completeERC8004Registration,
    awardERC8004XP,
    refreshERC8004Stats,
    agentStats,
    isLoading,
    error,
  } = useDeployERC8004()
  const [deployResult, setDeployResult] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serviceEndpoints: '',
    x402Support: true,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return undefined
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const result = await deployERC8004Agent({ ...formData, imageFile })
      setDeployResult(result)
      refreshERC8004Stats()
    } catch (deployError) {
      console.error('ERC-8004 deploy failed:', deployError)
    }
  }

  const handleCompleteRegistration = async () => {
    if (!deployResult || deployResult.isComplete) return

    try {
      const completion = await completeERC8004Registration({
        agentId: deployResult.agentId,
        identityRegistry: deployResult.identityRegistry,
        finalMetadata: deployResult.finalMetadata,
      })
      setDeployResult(prev => ({
        ...prev,
        ...completion,
      }))
      refreshERC8004Stats()
    } catch (completeError) {
      console.error('ERC-8004 registration completion failed:', completeError)
    }
  }

  const handleRetryXP = async () => {
    if (!deployResult?.metadataTxHash || deployResult.xpAwarded) return

    try {
      const xpResult = await awardERC8004XP({ txHash: deployResult.metadataTxHash })
      setDeployResult(prev => ({
        ...prev,
        ...xpResult,
        xpError: null,
      }))
    } catch (xpError) {
      console.error('ERC-8004 XP retry failed:', xpError)
      setDeployResult(prev => ({
        ...prev,
        xpAwarded: false,
        xpEarned: 0,
        xpError: xpError.message || 'XP could not be saved. Please retry XP.',
      }))
    }
  }

  const formatAddress = (value) => {
    if (!value) return ''
    return `${String(value).slice(0, 6)}...${String(value).slice(-4)}`
  }

  const agentCountLabel = agentStats.isLoading && agentStats.totalRegistered == null
    ? 'Loading...'
    : agentStats.totalRegistered == null
      ? 'Unavailable'
      : agentStats.totalRegistered.toLocaleString()

  const pageStyles = {
    shell: {
      maxWidth: '1120px',
      margin: '0 auto',
      padding: '24px 12px 64px',
    },
    hero: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)',
      gap: '20px',
      alignItems: 'stretch',
      marginTop: '18px',
    },
    panel: {
      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.92))',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      borderRadius: '8px',
      boxShadow: '0 18px 60px rgba(0, 0, 0, 0.28)',
    },
    headerPanel: {
      padding: '26px',
      minHeight: '100%',
      position: 'relative',
      overflow: 'hidden',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '7px 10px',
      border: '1px solid rgba(34, 197, 94, 0.35)',
      background: 'rgba(34, 197, 94, 0.1)',
      color: '#86efac',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 800,
      marginBottom: '18px',
    },
    title: {
      margin: '0 0 12px',
      color: '#f8fafc',
      fontSize: 'clamp(32px, 5vw, 56px)',
      lineHeight: 1,
      letterSpacing: 0,
      fontWeight: 900,
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: '16px',
      lineHeight: 1.65,
      margin: '0 0 24px',
      maxWidth: '620px',
    },
    statRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: '10px',
      marginTop: '22px',
    },
    stat: {
      border: '1px solid rgba(148, 163, 184, 0.14)',
      background: 'rgba(15, 23, 42, 0.58)',
      borderRadius: '8px',
      padding: '12px',
      minHeight: '78px',
    },
    statLabel: {
      display: 'block',
      color: '#64748b',
      fontSize: '11px',
      fontWeight: 800,
      textTransform: 'uppercase',
      marginBottom: '8px',
    },
    statValue: {
      color: '#e2e8f0',
      fontSize: '14px',
      fontWeight: 800,
      wordBreak: 'break-word',
    },
    formPanel: {
      padding: '22px',
    },
    preview: {
      border: '1px solid rgba(148, 163, 184, 0.16)',
      background: 'rgba(15, 23, 42, 0.72)',
      borderRadius: '8px',
      padding: '14px',
      marginBottom: '18px',
      display: 'grid',
      gridTemplateColumns: '88px minmax(0, 1fr)',
      gap: '14px',
      alignItems: 'center',
    },
    avatar: {
      width: '88px',
      height: '88px',
      borderRadius: '8px',
      border: '1px solid rgba(34, 197, 94, 0.35)',
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(59, 130, 246, 0.12))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    textArea: {
      width: '100%',
      background: 'rgba(15, 23, 42, 0.82)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '8px',
      color: '#fff',
      padding: '12px 14px',
      resize: 'vertical',
      fontFamily: 'inherit',
      outline: 'none',
    },
    uploadBox: {
      border: '1px dashed rgba(148, 163, 184, 0.35)',
      background: 'rgba(15, 23, 42, 0.55)',
      borderRadius: '8px',
      padding: '14px',
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      cursor: 'pointer',
      color: '#cbd5e1',
    },
  }

  return (
    <NetworkGuard showWarning={true}>
      <div className="deploy-token-page">
        <Helmet>
          <title>Deploy ERC-8004 Agent - BaseHub</title>
          <meta name="description" content="Register a trustless AI agent identity with ERC-8004 on Base." />
        </Helmet>

        <div style={pageStyles.shell}>
          <BackButton />

          {!deployResult ? (
            <div className="erc8004-hero" style={pageStyles.hero}>
              <section style={{ ...pageStyles.panel, ...pageStyles.headerPanel }}>
                <div style={pageStyles.badge}>
                  <SparkleDot />
                  ERC-8004 ON BASE
                </div>
                <h1 style={pageStyles.title}>Deploy Agent Identity</h1>
                <p style={pageStyles.subtitle}>
                  Register your AI agent in the ERC-8004 Identity Registry, attach service metadata, and earn BaseHub XP.
                </p>

                <div style={pageStyles.preview}>
                  <div style={pageStyles.avatar}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Agent logo preview" style={pageStyles.avatarImage} />
                    ) : (
                      <Bot size={42} style={{ color: '#86efac' }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: '18px', marginBottom: '6px', overflowWrap: 'anywhere' }}>
                      {formData.name || 'Agent Name'}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                      {formData.description || 'Your agent description will appear here.'}
                    </div>
                  </div>
                </div>

                <div className="erc8004-stat-row" style={pageStyles.statRow}>
                  <div style={{ ...pageStyles.stat, borderColor: 'rgba(34, 197, 94, 0.22)', background: 'rgba(34, 197, 94, 0.07)' }}>
                    <span style={pageStyles.statLabel}>BaseHub Agents</span>
                    <span style={{ ...pageStyles.statValue, color: '#86efac', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={15} />
                      {agentCountLabel}
                    </span>
                  </div>
                  <div style={pageStyles.stat}>
                    <span style={pageStyles.statLabel}>Reward</span>
                    <span style={pageStyles.statValue}>{ERC8004_AGENT_XP_REWARD.toLocaleString()} XP</span>
                  </div>
                  <div style={pageStyles.stat}>
                    <span style={pageStyles.statLabel}>Steps</span>
                    <span style={pageStyles.statValue}>2 approvals</span>
                  </div>
                  <div style={pageStyles.stat}>
                    <span style={pageStyles.statLabel}>Network</span>
                    <span style={pageStyles.statValue}>Base</span>
                  </div>
                </div>
              </section>

              <form onSubmit={handleSubmit} style={{ ...pageStyles.panel, ...pageStyles.formPanel }}>
                <div className="form-group">
                  <label htmlFor="name">Agent Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="BaseHub Research Agent"
                    maxLength="48"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="What does this agent do?"
                    rows={4}
                    maxLength="500"
                    required
                    style={pageStyles.textArea}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="serviceEndpoints">Service Endpoints</label>
                  <textarea
                    id="serviceEndpoints"
                    name="serviceEndpoints"
                    value={formData.serviceEndpoints}
                    onChange={handleInputChange}
                    placeholder={'https://agent.example.com\nhttps://agent.example.com/.well-known/agent-card.json'}
                    rows={3}
                    style={pageStyles.textArea}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="imageFile">Agent Logo</label>
                  <label htmlFor="imageFile" style={pageStyles.uploadBox}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Uploaded agent logo" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px' }} />
                    ) : (
                      <ImageIcon size={28} style={{ color: '#94a3b8' }} />
                    )}
                    <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imageFile?.name || 'Upload logo'}
                    </span>
                    <Upload size={18} style={{ color: '#86efac' }} />
                  </label>
                  <input
                    type="file"
                    id="imageFile"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e5e7eb', fontSize: '14px', marginTop: '8px' }}>
                  <input
                    type="checkbox"
                    name="x402Support"
                    checked={formData.x402Support}
                    onChange={handleInputChange}
                  />
                  Supports x402 payments
                </label>

                <div className="deploy-info">
                  <div className="info-item">
                    <Network size={16} />
                    <span>Identity Registry</span>
                  </div>
                  <div className="info-item">
                    <Zap size={16} />
                    <span>+{ERC8004_AGENT_XP_REWARD.toLocaleString()} XP</span>
                  </div>
                </div>

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                <button type="submit" className="deploy-button" disabled={!isConnected || isLoading}>
                  {isLoading ? 'Waiting for wallet...' : 'Stage 1: Pay Fee & Get Agent NFT'}
                </button>

                {isLoading && (
                  <div style={{
                    background: 'rgba(14, 165, 233, 0.08)',
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    borderLeft: '3px solid #0ea5e9',
                    color: '#38bdf8',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginTop: '16px',
                    fontSize: '13px',
                    textAlign: 'center',
                  }}>
                    Stage 1 opens your wallet for fee payment and agent NFT mint/transfer.
                  </div>
                )}
              </form>

              <div style={{ gridColumn: '1 / -1' }}>
                <style>{`
                  @media (max-width: 860px) {
                    .erc8004-hero {
                      grid-template-columns: 1fr !important;
                    }
                    .erc8004-stat-row {
                      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }
                  }
                  @media (max-width: 860px) {
                    .deploy-token-page form {
                      min-width: 0;
                    }
                  }
                `}</style>
              </div>
            </div>
          ) : (
            <div className="deploy-success">
              <div className="success-icon">
                <CheckCircle size={48} />
              </div>
              <h2>{deployResult.isComplete ? 'ERC-8004 Agent Registered!' : 'Agent NFT Received'}</h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '10px',
                margin: '18px 0 22px',
              }}>
                <div style={{
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#86efac',
                  fontWeight: 800,
                  fontSize: '13px',
                }}>
                  Stage 1 complete: Fee paid + agent NFT received
                </div>
                <div style={{
                  border: `1px solid ${deployResult.isComplete ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.3)'}`,
                  background: deployResult.isComplete ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: deployResult.isComplete ? '#86efac' : '#fbbf24',
                  fontWeight: 800,
                  fontSize: '13px',
                }}>
                  {deployResult.isComplete ? 'Stage 2 complete: Registration finalized' : 'Stage 2 pending: Confirm registration'}
                </div>
              </div>

              <div className="deploy-details">
                <div className="detail-item"><strong>Agent Name:</strong> {formData.name}</div>
                <div className="detail-item"><strong>Agent ID:</strong> {deployResult.agentId}</div>
                <div className="detail-item">
                  <strong>Identity Registry:</strong>
                  <div className="tx-hash">
                    {formatAddress(deployResult.identityRegistry)}
                    <a href={getAddressExplorerUrl(chainId, deployResult.identityRegistry)} target="_blank" rel="noopener noreferrer" className="view-button">
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
                <div className="detail-item">
                  <strong>Stage 1 Transaction:</strong>
                  <div className="tx-hash">
                    {formatAddress(deployResult.registerTxHash)}
                    <a href={getTransactionExplorerUrl(chainId, deployResult.registerTxHash)} target="_blank" rel="noopener noreferrer" className="view-button">
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
                {deployResult.isComplete && deployResult.metadataTxHash && (
                <div className="detail-item">
                  <strong>Stage 2 Transaction:</strong>
                  <div className="tx-hash">
                    {formatAddress(deployResult.metadataTxHash)}
                    <a href={getTransactionExplorerUrl(chainId, deployResult.metadataTxHash)} target="_blank" rel="noopener noreferrer" className="view-button">
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
                )}
                <div className="detail-item">
                  <strong>Metadata:</strong>
                  <div className="tx-hash">
                    <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>{deployResult.agentURI}</span>
                    <a href={deployResult.agentURI} target="_blank" rel="noopener noreferrer" className="view-button">
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
                <div className="detail-item">
                  <strong>XP Earned:</strong>
                  <div
                    className="status-message"
                    style={{
                      background: deployResult.isComplete && !deployResult.xpAwarded ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      border: deployResult.isComplete && !deployResult.xpAwarded ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                      borderLeft: deployResult.isComplete && !deployResult.xpAwarded ? '3px solid #f59e0b' : '3px solid #34d399',
                      color: deployResult.isComplete && !deployResult.xpAwarded ? '#fbbf24' : '#34d399',
                    }}
                  >
                    {deployResult.isComplete
                      ? deployResult.xpAwarded
                        ? `+${Number(deployResult.xpEarned || ERC8004_AGENT_XP_REWARD).toLocaleString()} XP earned`
                        : 'Registration complete. XP is pending.'
                      : 'Complete Stage 2 to earn XP'}
                  </div>
                </div>
              </div>

              {!deployResult.isComplete && (
                <div style={{
                  marginTop: '22px',
                  padding: '18px',
                  border: '1px solid rgba(245, 158, 11, 0.22)',
                  background: 'rgba(245, 158, 11, 0.07)',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}>
                  <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '15px', marginBottom: '8px' }}>
                    Final step required
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                    Your agent NFT is already in your wallet. Confirm this second transaction to attach the final ERC-8004 metadata with the agent ID and receive XP.
                  </div>
                  <button
                    type="button"
                    className="deploy-button"
                    onClick={handleCompleteRegistration}
                    disabled={isLoading}
                    style={{ maxWidth: '420px', margin: '0 auto' }}
                  >
                    {isLoading ? 'Waiting for wallet...' : 'Stage 2: Complete Registration'}
                  </button>
                </div>
              )}

              {deployResult.isComplete && !deployResult.xpAwarded && (
                <div style={{
                  marginTop: '22px',
                  padding: '18px',
                  border: '1px solid rgba(245, 158, 11, 0.22)',
                  background: 'rgba(245, 158, 11, 0.07)',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}>
                  <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '15px', marginBottom: '8px' }}>
                    XP is pending
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                    Your ERC-8004 registration is complete, but XP could not be saved yet. Retry only saves XP; it will not open another on-chain transaction.
                  </div>
                  {deployResult.xpError && (
                    <div className="error-message" style={{ marginBottom: '14px' }}>
                      {deployResult.xpError}
                    </div>
                  )}
                  <button
                    type="button"
                    className="deploy-button"
                    onClick={handleRetryXP}
                    disabled={isLoading}
                    style={{ maxWidth: '420px', margin: '0 auto' }}
                  >
                    {isLoading ? 'Saving XP...' : 'Retry XP'}
                  </button>
                </div>
              )}

              {deployResult.isComplete && deployResult.xpAwarded && (
              <div style={{ marginTop: '20px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                <ShareButton
                  title={`I registered ${formData.name || 'an ERC-8004 agent'} on BaseHub`}
                  description={`Agent ID ${deployResult.agentId}. Register your own ERC-8004 agent and earn ${ERC8004_AGENT_XP_REWARD.toLocaleString()} XP.`}
                  gameType="deploy"
                  customUrl="https://basehub.fun/deploy-erc8004"
                />
              </div>
              )}

              {deployResult.isComplete && deployResult.xpAwarded && (
              <div className="success-actions">
                <button onClick={() => setDeployResult(null)} className="deploy-another-button">
                  Register Another Agent
                </button>
                <button onClick={() => navigate('/')} className="home-button">
                  Home
                </button>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </NetworkGuard>
  )
}

function SparkleDot() {
  return (
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '999px',
      background: '#22c55e',
      boxShadow: '0 0 16px rgba(34, 197, 94, 0.8)',
      display: 'inline-block',
    }} />
  )
}

export default DeployERC8004
