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
      }, 1800) // Match animation duration

      return () => clearTimeout(timer)
    } else if (!isRevealing) {
      animationEndHandled.current = false
    }
  }, [isRevealing, onSpinComplete])

  return (
    <div
      style={{
        perspective: '1200px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '60px 0',
        minHeight: '280px',
        position: 'relative'
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
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      )}
      
      <div
        ref={coinRef}
        style={{
          width: `${size * 1.3}px`,
          height: `${size * 1.3}px`,
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: isSpinning 
            ? 'coinSpin 0.35s linear infinite' 
            : isRevealing 
            ? `coinReveal-${finalRotation} 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards` 
            : 'none',
          filter: isSpinning ? 'drop-shadow(0 0 30px rgba(245, 158, 11, 0.6))' : 'drop-shadow(0 10px 40px rgba(0, 0, 0, 0.4))',
          zIndex: 1
        }}
      >
        {/* Coin Front (Heads) */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: `
              radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4) 0%, transparent 50%),
              linear-gradient(135deg, #fbbf24 0%, #f59e0b 30%, #d97706 70%, #b45309 100%)
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '64px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '2px 2px 8px rgba(0, 0, 0, 0.5)',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(0deg) translateZ(2px)',
            boxShadow: `
              0 0 40px rgba(245, 158, 11, 0.6),
              inset 0 0 30px rgba(255, 255, 255, 0.3),
              inset -15px -15px 40px rgba(0, 0, 0, 0.4),
              0 8px 20px rgba(0, 0, 0, 0.3)
            `,
            border: '6px solid rgba(255, 255, 255, 0.4)',
            borderTop: '6px solid rgba(255, 255, 255, 0.6)',
            borderLeft: '6px solid rgba(255, 255, 255, 0.6)'
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
            background: `
              radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
              linear-gradient(135deg, #d97706 0%, #b45309 30%, #92400e 70%, #78350f 100%)
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '64px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '2px 2px 8px rgba(0, 0, 0, 0.5)',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg) translateZ(2px)',
            boxShadow: `
              0 0 40px rgba(217, 119, 6, 0.6),
              inset 0 0 30px rgba(255, 255, 255, 0.25),
              inset -15px -15px 40px rgba(0, 0, 0, 0.4),
              0 8px 20px rgba(0, 0, 0, 0.3)
            `,
            border: '6px solid rgba(255, 255, 255, 0.35)',
            borderTop: '6px solid rgba(255, 255, 255, 0.5)',
            borderLeft: '6px solid rgba(255, 255, 255, 0.5)'
          }}
        >
          ⭐
        </div>

        {/* Enhanced glow effect */}
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
                background: `radial-gradient(circle, rgba(245, 158, 11, ${isSpinning ? 0.4 : 0.2}) 0%, transparent 60%)`,
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
                background: `radial-gradient(circle, rgba(245, 158, 11, ${isSpinning ? 0.2 : 0.1}) 0%, transparent 70%)`,
                animation: isSpinning ? 'pulse 1.5s ease-in-out infinite' : 'none',
                pointerEvents: 'none',
                zIndex: -2
              }}
            />
          </>
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

export default Coin3D

