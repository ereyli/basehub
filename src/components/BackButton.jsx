import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const BackButton = ({ style = {} }) => {
  const navigate = useNavigate()

  const goHome = () => {
    // Use browser back so popstate fires and scroll position is restored
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <button 
      className="back-button"
      onClick={goHome}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        padding: '8px 14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '20px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#94a3b8',
        transition: 'all 0.2s ease',
        position: 'relative',
        zIndex: 1000,
        boxShadow: 'none',
        backdropFilter: 'blur(8px)',
        ...style
      }}
      onMouseEnter={(e) => {
        e.target.style.background = 'rgba(255, 255, 255, 0.1)'
        e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'
        e.target.style.color = '#e2e8f0'
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'rgba(255, 255, 255, 0.05)'
        e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'
        e.target.style.color = '#94a3b8'
      }}
    >
      <ArrowLeft size={16} />
      Home
    </button>
  )
}

export default BackButton
