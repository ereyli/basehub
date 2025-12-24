import React, { useEffect, useRef } from 'react'

const Coin3D = ({ 
  isSpinning, 
  isRevealing, 
  result, 
  size = 120,
  onSpinComplete 
}) => {
  const coinRef = useRef(null)
  const animationEndHandled = useRef(false)

  const getCoinFace = () => {
    if (!result) return 'heads'
    return result.toLowerCase()
  }

  const coinFace = getCoinFace()
  const finalRotation = coinFace === 'heads' ? 0 : 180

  useEffect(() => {
    if (isRevealing && !animationEndHandled.current) {
      const timer = setTimeout(() => {
        if (onSpinComplete && coinRef.current) {
          animationEndHandled.current = true
          onSpinComplete()
        }
      }, 1000) // Match animation duration

      return () => clearTimeout(timer)
    } else if (!isRevealing) {
      animationEndHandled.current = false
    }
  }, [isRevealing, onSpinComplete])

  return (
    <div
      style={{
        perspective: '1000px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '40px 0',
        minHeight: '200px'
      }}
    >
      <div
        ref={coinRef}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: isSpinning 
            ? 'coinSpin 0.1s linear infinite' 
            : isRevealing 
            ? `coinReveal-${finalRotation} 1s ease-out forwards` 
            : 'none'
        }}
      >
        {/* Coin Front (Heads) */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            color: 'white',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
            boxShadow: `
              0 0 20px rgba(245, 158, 11, 0.5),
              inset 0 0 20px rgba(255, 255, 255, 0.2),
              inset -10px -10px 30px rgba(0, 0, 0, 0.3)
            `,
            border: '4px solid rgba(255, 255, 255, 0.3)'
          }}
        >
          🪙
        </div>

        {/* Coin Back (Tails) */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            color: 'white',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: `
              0 0 20px rgba(217, 119, 6, 0.5),
              inset 0 0 20px rgba(255, 255, 255, 0.2),
              inset -10px -10px 30px rgba(0, 0, 0, 0.3)
            `,
            border: '4px solid rgba(255, 255, 255, 0.3)'
          }}
        >
          ⭐
        </div>

        {/* Glow effect */}
        {(isSpinning || isRevealing) && (
          <div
            style={{
              position: 'absolute',
              width: '120%',
              height: '120%',
              top: '-10%',
              left: '-10%',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(245, 158, 11, ${isSpinning ? 0.6 : 0.3}) 0%, transparent 70%)`,
              animation: isSpinning ? 'pulse 0.5s ease-in-out infinite' : 'none',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes coinSpin {
          from {
            transform: rotateY(0deg);
          }
          to {
            transform: rotateY(360deg);
          }
        }

        @keyframes coinReveal-0 {
          0% {
            transform: rotateY(0deg) scale(1);
          }
          50% {
            transform: rotateY(180deg) scale(1.2);
          }
          100% {
            transform: rotateY(0deg) scale(1);
          }
        }

        @keyframes coinReveal-180 {
          0% {
            transform: rotateY(0deg) scale(1);
          }
          50% {
            transform: rotateY(180deg) scale(1.2);
          }
          100% {
            transform: rotateY(180deg) scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  )
}

export default Coin3D

