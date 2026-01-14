import React from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'

const UserProfile = () => {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  if (!isConnected || !address) {
    return null
  }

  return (
    <button
      onClick={() => navigate('/profile')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
        transition: 'all 0.2s ease',
        marginLeft: '8px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
      }}
      title="User Profile"
    >
      <User size={18} style={{ color: 'white' }} />
    </button>
  )
}

export default UserProfile

