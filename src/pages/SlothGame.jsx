import React, { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { Clock, Play, Pause, RotateCcw, Coins } from 'lucide-react'

const SlothGame = () => {
  const { isConnected, address } = useWallet()
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [currentSession, setCurrentSession] = useState(null)
  const [sessions, setSessions] = useState([])

  // Timer effect
  useEffect(() => {
    let interval = null
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeElapsed(time => {
          const newTime = time + 1
          // Earn 1 token every 10 seconds
          if (newTime % 10 === 0) {
            setTotalEarned(prev => prev + 1)
          }
          return newTime
        })
      }, 1000)
    } else if (!isPlaying && timeElapsed !== 0) {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [isPlaying, timeElapsed])

  const startGame = () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    setIsPlaying(true)
    setCurrentSession({
      startTime: new Date(),
      tokensEarned: 0
    })
  }

  const pauseGame = () => {
    setIsPlaying(false)
  }

  const resetGame = () => {
    if (currentSession && timeElapsed > 0) {
      // Save session
      const session = {
        ...currentSession,
        endTime: new Date(),
        duration: timeElapsed,
        tokensEarned: Math.floor(timeElapsed / 10)
      }
      setSessions(prev => [session, ...prev.slice(0, 9)]) // Keep last 10 sessions
    }
    
    setIsPlaying(false)
    setTimeElapsed(0)
    setCurrentSession(null)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!isConnected) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Clock size={64} style={{ color: '#6b7280', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
            Connect Your Wallet
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Connect your wallet to start the sloth game and earn tokens by being patient
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sloth-game">
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <img src="/crypto-logos/basahub logo/CryptoSloth.png" alt="Sloth Game" loading="lazy" style={{ width: '80px', height: '80px', borderRadius: '20px' }} />
          </div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#1f2937'
          }}>
            Sloth Game
          </h1>
          <p style={{ 
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Be patient and earn tokens by doing nothing!
          </p>
        </div>

        <div style={{ 
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Coins size={20} style={{ color: '#8b5cf6' }} />
            <span style={{ fontWeight: 'bold', color: '#1f2937' }}>
              Total Tokens Earned: {totalEarned}
            </span>
          </div>
          
          <div style={{ 
            textAlign: 'center',
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ 
              fontSize: '48px', 
              fontWeight: 'bold',
              color: '#8b5cf6',
              marginBottom: '8px'
            }}>
              {formatTime(timeElapsed)}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              Time Elapsed
            </div>
          </div>

          <div style={{ 
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Earn 1 token every 10 seconds of patience
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="btn btn-primary"
              style={{ 
                flex: 1,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
              }}
            >
              <Play size={20} />
              Start Being Patient
            </button>
          ) : (
            <button
              onClick={pauseGame}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              <Pause size={20} />
              Pause
            </button>
          )}
          
          <button
            onClick={resetGame}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            <RotateCcw size={20} />
            Reset
          </button>
        </div>

        {isPlaying && (
          <div style={{ 
            marginBottom: '24px',
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '18px',
              color: '#10b981',
              fontWeight: 'bold',
              marginBottom: '8px'
            }}>
              🦥 Being Patient...
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              Keep the game running to earn tokens. The longer you wait, the more you earn!
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <div style={{ 
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px'
          }}>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: 'bold', 
              marginBottom: '12px',
              color: '#1f2937'
            }}>
              Recent Sessions:
            </h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {sessions.map((session, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
                  fontSize: '14px'
                }}>
                  <span style={{ color: '#6b7280' }}>
                    {formatTime(session.duration)} - {session.startTime.toLocaleTimeString()}
                  </span>
                  <span style={{ 
                    color: '#8b5cf6',
                    fontWeight: 'bold'
                  }}>
                    +{session.tokensEarned} tokens
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ 
          marginTop: '24px',
          padding: '16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '8px'
        }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#1f2937'
          }}>
            💡 How it works:
          </h3>
          <ul style={{ 
            color: '#6b7280', 
            fontSize: '14px',
            margin: 0,
            paddingLeft: '20px'
          }}>
            <li>Start the game and be patient - do nothing!</li>
            <li>Earn 1 token every 10 seconds of patience</li>
            <li>Pause anytime to take a break</li>
            <li>Reset to start a new session</li>
            <li>Your wallet address: {address?.slice(0, 6)}...{address?.slice(-4)}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default SlothGame
