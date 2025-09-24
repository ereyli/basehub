import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const BackButton = ({ style = {} }) => {
  const navigate = useNavigate()

  return (
    <button 
      className="back-button"
      onClick={() => navigate('/')}
      style={{
        background: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '20px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        transition: 'all 0.2s ease',
        position: 'relative',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        ...style
      }}
      onMouseEnter={(e) => {
        e.target.style.background = 'rgba(255, 255, 255, 1)'
        e.target.style.transform = 'translateY(-1px)'
        e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'rgba(255, 255, 255, 0.9)'
        e.target.style.transform = 'translateY(0)'
        e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <ArrowLeft size={16} />
      Home
    </button>
  )
}

export default BackButton
