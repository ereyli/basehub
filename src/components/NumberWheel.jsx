import React, { useEffect, useState } from 'react'

const NumberWheel = ({ 
  isSpinning, 
  isRevealing, 
  winningNumber, 
  selectedNumber,
  onSpinComplete 
}) => {
  const [displayNumbers, setDisplayNumbers] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (isSpinning) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % 10)
        // Shuffle numbers for visual effect
        setDisplayNumbers(prev => {
          const shuffled = [...prev]
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
          }
          return shuffled
        })
      }, 150) // Change number every 150ms

      return () => clearInterval(interval)
    }
  }, [isSpinning])

  useEffect(() => {
    if (isRevealing && winningNumber) {
      // Slow down and reveal the winning number
      const revealInterval = setInterval(() => {
        setCurrentIndex(prev => {
          const next = (prev + 1) % 10
          if (next === winningNumber - 1) {
            clearInterval(revealInterval)
            setTimeout(() => {
              if (onSpinComplete) onSpinComplete()
            }, 500)
            return next
          }
          return next
        })
      }, 200)

      return () => clearInterval(revealInterval)
    }
  }, [isRevealing, winningNumber, onSpinComplete])

  const getDisplayNumber = () => {
    if (isRevealing && winningNumber) {
      return winningNumber
    }
    return displayNumbers[currentIndex]
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '60px 0',
        minHeight: '280px',
        position: 'relative',
        perspective: '1200px'
      }}
    >
      {/* Ambient light effect */}
      {(isSpinning || isRevealing) && (
        <div
          style={{
            position: 'absolute',
            width: '200%',
            height: '200%',
            top: '-50%',
            left: '-50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      )}

      {/* Main number display */}
      <div
        style={{
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4) 0%, transparent 50%),
            linear-gradient(135deg, #a78bfa 0%, #8b5cf6 30%, #7c3aed 70%, #6d28d9 100%)
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '120px',
          fontWeight: 'bold',
          color: 'white',
          textShadow: '4px 4px 12px rgba(0, 0, 0, 0.6)',
          boxShadow: `
            0 0 50px rgba(139, 92, 246, 0.7),
            inset 0 0 40px rgba(255, 255, 255, 0.3),
            inset -20px -20px 50px rgba(0, 0, 0, 0.4),
            0 12px 30px rgba(0, 0, 0, 0.4)
          `,
          border: '8px solid rgba(255, 255, 255, 0.4)',
          borderTop: '8px solid rgba(255, 255, 255, 0.6)',
          borderLeft: '8px solid rgba(255, 255, 255, 0.6)',
          filter: (isSpinning || isRevealing) 
            ? 'drop-shadow(0 0 40px rgba(139, 92, 246, 0.8))' 
            : 'drop-shadow(0 12px 40px rgba(0, 0, 0, 0.4))',
          animation: isSpinning 
            ? 'numberSpin 0.15s linear infinite' 
            : isRevealing 
            ? 'numberReveal 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' 
            : 'none',
          transform: isSpinning ? 'rotateY(360deg)' : 'none',
          transformStyle: 'preserve-3d',
          zIndex: 1,
          transition: isRevealing ? 'transform 0.3s ease-out' : 'none'
        }}
      >
        {getDisplayNumber()}
      </div>

      {/* Glow effect layers */}
      {(isSpinning || isRevealing) && (
        <>
          <div
            style={{
              position: 'absolute',
              width: '140%',
              height: '140%',
              top: '-20%',
              left: '-20%',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(139, 92, 246, ${isSpinning ? 0.4 : 0.2}) 0%, transparent 60%)`,
              animation: isSpinning ? 'pulse 1.2s ease-in-out infinite' : 'none',
              pointerEvents: 'none',
              zIndex: -1
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: '160%',
              height: '160%',
              top: '-30%',
              left: '-30%',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(139, 92, 246, ${isSpinning ? 0.2 : 0.1}) 0%, transparent 70%)`,
              animation: isSpinning ? 'pulse 1.5s ease-in-out infinite' : 'none',
              pointerEvents: 'none',
              zIndex: -2
            }}
          />
        </>
      )}

      <style>{`
        @keyframes numberSpin {
          from {
            transform: rotateY(0deg) scale(1);
          }
          to {
            transform: rotateY(360deg) scale(1);
          }
        }

        @keyframes numberReveal {
          0% {
            transform: rotateY(0deg) scale(1);
          }
          30% {
            transform: rotateY(180deg) scale(1.3);
          }
          60% {
            transform: rotateY(360deg) scale(1.1);
          }
          100% {
            transform: rotateY(360deg) scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  )
}

export default NumberWheel

