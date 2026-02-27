import React, { useEffect, useState } from 'react'

const Dice3D = ({ 
  isRolling, 
  isRevealing, 
  dice1, 
  dice2,
  onRollComplete,
  compact = false
}) => {
  const [displayDice1, setDisplayDice1] = useState(1)
  const [displayDice2, setDisplayDice2] = useState(1)

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setDisplayDice1(Math.floor(Math.random() * 6) + 1)
        setDisplayDice2(Math.floor(Math.random() * 6) + 1)
      }, 100) // Change dice faces every 100ms

      return () => clearInterval(interval)
    }
  }, [isRolling])

  useEffect(() => {
    if (isRevealing && dice1 && dice2) {
      // Reveal the actual dice values
      setDisplayDice1(dice1)
      setDisplayDice2(dice2)
      
      setTimeout(() => {
        if (onRollComplete) onRollComplete()
      }, 1500)
    }
  }, [isRevealing, dice1, dice2, onRollComplete])

  const getDiceFace = (value) => {
    const faces = {
      1: '⚀',
      2: '⚁',
      3: '⚂',
      4: '⚃',
      5: '⚄',
      6: '⚅'
    }
    return faces[value] || '⚀'
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: compact ? '20px' : '40px',
        margin: compact ? '24px 0' : '60px 0',
        minHeight: compact ? '160px' : '280px',
        position: 'relative',
        perspective: '1200px'
      }}
    >
      {/* Ambient light effect */}
      {(isRolling || isRevealing) && (
        <div
          style={{
            position: 'absolute',
            width: '200%',
            height: '200%',
            top: '-50%',
            left: '-50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      )}

      {/* Dice 1 */}
      <div
        style={{
          width: compact ? '90px' : '140px',
          height: compact ? '90px' : '140px',
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: isRolling 
            ? 'diceRoll 0.2s linear infinite' 
            : isRevealing 
            ? 'diceReveal 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' 
            : 'none',
          filter: (isRolling || isRevealing) 
            ? 'drop-shadow(0 0 30px rgba(245, 158, 11, 0.7))' 
            : 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.4))',
          zIndex: 1
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: compact ? '14px' : '20px',
            background: `
              radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4) 0%, transparent 50%),
              linear-gradient(135deg, #fbbf24 0%, #f59e0b 30%, #d97706 70%, #b45309 100%)
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? '50px' : '80px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '3px 3px 10px rgba(0, 0, 0, 0.6)',
            boxShadow: `
              0 0 40px rgba(245, 158, 11, 0.6),
              inset 0 0 30px rgba(255, 255, 255, 0.3),
              inset -15px -15px 40px rgba(0, 0, 0, 0.4),
              0 10px 25px rgba(0, 0, 0, 0.3)
            `,
            border: '6px solid rgba(255, 255, 255, 0.4)',
            borderTop: '6px solid rgba(255, 255, 255, 0.6)',
            borderLeft: '6px solid rgba(255, 255, 255, 0.6)'
          }}
        >
          {getDiceFace(displayDice1)}
        </div>
      </div>

      {/* Plus sign */}
      {(isRevealing || (!isRolling && dice1 && dice2)) && (
        <div
          style={{
            fontSize: compact ? '28px' : '48px',
            fontWeight: 'bold',
            color: '#e5e7eb',
            animation: isRevealing ? 'fadeIn 0.5s ease-out 0.5s both' : 'none',
            zIndex: 1
          }}
        >
          +
        </div>
      )}

      {/* Dice 2 */}
      <div
        style={{
          width: compact ? '90px' : '140px',
          height: compact ? '90px' : '140px',
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: isRolling 
            ? 'diceRoll 0.2s linear infinite' 
            : isRevealing 
            ? 'diceReveal 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' 
            : 'none',
          filter: (isRolling || isRevealing) 
            ? 'drop-shadow(0 0 30px rgba(245, 158, 11, 0.7))' 
            : 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.4))',
          zIndex: 1
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: compact ? '14px' : '20px',
            background: `
              radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4) 0%, transparent 50%),
              linear-gradient(135deg, #fbbf24 0%, #f59e0b 30%, #d97706 70%, #b45309 100%)
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? '50px' : '80px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '3px 3px 10px rgba(0, 0, 0, 0.6)',
            boxShadow: `
              0 0 40px rgba(245, 158, 11, 0.6),
              inset 0 0 30px rgba(255, 255, 255, 0.3),
              inset -15px -15px 40px rgba(0, 0, 0, 0.4),
              0 10px 25px rgba(0, 0, 0, 0.3)
            `,
            border: '6px solid rgba(255, 255, 255, 0.4)',
            borderTop: '6px solid rgba(255, 255, 255, 0.6)',
            borderLeft: '6px solid rgba(255, 255, 255, 0.6)'
          }}
        >
          {getDiceFace(displayDice2)}
        </div>
      </div>

      {/* Total display */}
      {(isRevealing || (!isRolling && dice1 && dice2)) && (
        <div
          style={{
            position: 'absolute',
            bottom: compact ? '-40px' : '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: compact ? '22px' : '32px',
            fontWeight: 'bold',
            color: '#f59e0b',
            background: 'rgba(30, 41, 59, 0.9)',
            padding: '12px 24px',
            borderRadius: '12px',
            border: '2px solid rgba(245, 158, 11, 0.3)',
            animation: isRevealing ? 'fadeIn 0.5s ease-out 1s both' : 'none',
            zIndex: 1
          }}
        >
          = {dice1 + dice2}
        </div>
      )}

      {/* Glow effect layers */}
      {(isRolling || isRevealing) && (
        <>
          <div
            style={{
              position: 'absolute',
              width: '140%',
              height: '140%',
              top: '-20%',
              left: '-20%',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(245, 158, 11, ${isRolling ? 0.3 : 0.15}) 0%, transparent 60%)`,
              animation: isRolling ? 'pulse 1.2s ease-in-out infinite' : 'none',
              pointerEvents: 'none',
              zIndex: -1
            }}
          />
        </>
      )}

      <style>{`
        @keyframes diceRoll {
          0% {
            transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
          25% {
            transform: rotateX(90deg) rotateY(90deg) rotateZ(90deg);
          }
          50% {
            transform: rotateX(180deg) rotateY(180deg) rotateZ(180deg);
          }
          75% {
            transform: rotateX(270deg) rotateY(270deg) rotateZ(270deg);
          }
          100% {
            transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg);
          }
        }

        @keyframes diceReveal {
          0% {
            transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1);
          }
          30% {
            transform: rotateX(180deg) rotateY(180deg) rotateZ(180deg) scale(1.2);
          }
          60% {
            transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg) scale(1.1);
          }
          100% {
            transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg) scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
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

export default Dice3D

