import React, { useEffect, useState } from 'react'

const Confetti = ({ active, onComplete }) => {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!active) {
      setParticles([])
      return
    }

    // Create confetti particles
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10,
      angle: Math.random() * 360,
      speed: 2 + Math.random() * 3,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      color: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][Math.floor(Math.random() * 6)],
      size: 8 + Math.random() * 8,
      delay: Math.random() * 0.5
    }))

    setParticles(newParticles)

    // Cleanup after animation
    const timer = setTimeout(() => {
      if (onComplete) onComplete()
    }, 3000)

    return () => clearTimeout(timer)
  }, [active, onComplete])

  if (!active || particles.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 10000,
        overflow: 'hidden'
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            borderRadius: '50%',
            animation: `confettiFall ${2 + Math.random()}s ease-out forwards`,
            animationDelay: `${particle.delay}s`,
            transform: `rotate(${particle.rotation}deg)`,
            boxShadow: `0 0 ${particle.size}px ${particle.color}`
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

export default Confetti

