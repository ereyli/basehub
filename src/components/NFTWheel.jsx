import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Trophy, Gift } from 'lucide-react'

// Wheel segments with their properties
const DEFAULT_SEGMENTS = [
  { id: 6, xp: 50000, label: '50K', color: '#fbbf24', isJackpot: true },
  { id: 0, xp: 2000, label: '2K', color: '#3b82f6' },
  { id: 1, xp: 3000, label: '3K', color: '#10b981' },
  { id: 2, xp: 5000, label: '5K', color: '#8b5cf6' },
  { id: 3, xp: 7500, label: '7.5K', color: '#ec4899' },
  { id: 4, xp: 10000, label: '10K', color: '#06b6d4' },
  { id: 5, xp: 15000, label: '15K', color: '#ef4444' }
]

const NFTWheel = ({ 
  isSpinning, 
  winningSegment, 
  onSpinComplete,
  segments = DEFAULT_SEGMENTS
}) => {
  const [rotation, setRotation] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const canvasRef = useRef(null)
  const spinDuration = 4000

  const segmentCount = segments.length
  const segmentAngle = 360 / segmentCount

  // Draw wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const center = size / 2
    const radius = center - 10

    // Clear canvas
    ctx.clearRect(0, 0, size, size)

    // Draw segments
    segments.forEach((segment, index) => {
      const startAngle = (index * segmentAngle - 90) * (Math.PI / 180)
      const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180)

      // Draw segment
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startAngle, endAngle)
      ctx.closePath()

      // Fill with gradient
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius)
      if (segment.isJackpot) {
        gradient.addColorStop(0, '#fbbf24')
        gradient.addColorStop(1, '#f59e0b')
      } else {
        gradient.addColorStop(0, segment.color)
        gradient.addColorStop(1, adjustColor(segment.color, -30))
      }
      ctx.fillStyle = gradient
      ctx.fill()

      // Segment border
      ctx.strokeStyle = segment.isJackpot ? 'rgba(251, 191, 36, 0.8)' : 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = segment.isJackpot ? 3 : 2
      ctx.stroke()

      // Draw text
      const textAngle = (index * segmentAngle + segmentAngle / 2 - 90) * (Math.PI / 180)
      const textRadius = radius * 0.65
      const textX = center + textRadius * Math.cos(textAngle)
      const textY = center + textRadius * Math.sin(textAngle)

      ctx.save()
      ctx.translate(textX, textY)
      ctx.rotate(textAngle + Math.PI / 2)

      // Draw XP label
      ctx.fillStyle = 'white'
      ctx.font = `bold ${segment.isJackpot ? '28px' : '24px'} system-ui`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 4
      ctx.fillText(segment.label, 0, -8)
      
      ctx.font = 'bold 14px system-ui'
      ctx.fillText('XP', 0, 12)

      // Trophy for jackpot
      if (segment.isJackpot) {
        ctx.font = '20px system-ui'
        ctx.fillText('🏆', 0, -35)
      }

      ctx.restore()
    })

    // Draw center circle
    ctx.beginPath()
    ctx.arc(center, center, 45, 0, Math.PI * 2)
    const centerGradient = ctx.createRadialGradient(center, center, 0, center, center, 45)
    centerGradient.addColorStop(0, '#a78bfa')
    centerGradient.addColorStop(1, '#7c3aed')
    ctx.fillStyle = centerGradient
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 4
    ctx.stroke()

    // Draw sparkle icon in center
    ctx.fillStyle = 'white'
    ctx.font = '32px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✨', center, center)

  }, [segments, segmentAngle])

  // Handle spinning - triggered when isSpinning becomes true with a valid winningSegment
  useEffect(() => {
    // Only start spinning when both conditions are met
    if (isSpinning && winningSegment !== null) {
      console.log('🎰 NFTWheel: Starting spin animation for segment:', winningSegment)
      setShowResult(false)
      
      // Find visual index of winning segment
      const visualIndex = segments.findIndex(seg => seg.id === winningSegment)
      if (visualIndex === -1) {
        console.error('❌ NFTWheel: Winning segment not found:', winningSegment, 'in segments:', segments.map(s => s.id))
        return
      }

      console.log('🎯 NFTWheel: Visual index:', visualIndex, 'Segment angle:', segmentAngle)

      // Calculate rotation: multiple spins + land on winning segment
      // The pointer is at top (12 o'clock), so we need to rotate to bring the winning segment there
      const spins = 5
      const targetAngle = spins * 360 + (360 - visualIndex * segmentAngle - segmentAngle / 2)
      
      console.log('🔄 NFTWheel: Rotating by', targetAngle, 'degrees')
      setRotation(prev => prev + targetAngle)

      // Show result after spin animation completes (spinDuration = 4000ms)
      const resultTimer = setTimeout(() => {
        console.log('✅ NFTWheel: Spin complete, showing result')
        setShowResult(true)
        
        // Call onSpinComplete callback after a brief delay to show the result
        if (onSpinComplete) {
          setTimeout(() => {
            console.log('📞 NFTWheel: Calling onSpinComplete callback')
            onSpinComplete()
          }, 800)
        }
      }, spinDuration + 100) // Add small buffer after CSS transition

      return () => {
        clearTimeout(resultTimer)
      }
    }
  }, [isSpinning, winningSegment]) // Only depend on these two values

  // Reset rotation when idle
  useEffect(() => {
    if (!isSpinning && winningSegment === null) {
      setShowResult(false)
    }
  }, [isSpinning, winningSegment])

  const winningSegmentData = winningSegment !== null 
    ? segments.find(s => s.id === winningSegment) 
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px'
    }}>
      {/* Wheel Container */}
      <div style={{
        position: 'relative',
        width: '380px',
        height: '380px',
        maxWidth: '85vw',
        maxHeight: '85vw'
      }}>
        {/* Pointer */}
        <div style={{
          position: 'absolute',
          top: '-15px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '18px solid transparent',
          borderRight: '18px solid transparent',
          borderTop: '36px solid #8b5cf6',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))',
          zIndex: 20
        }} />

        {/* Outer ring glow */}
        <div style={{
          position: 'absolute',
          inset: '-15px',
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #8b5cf6, #3b82f6, #10b981, #f59e0b, #ef4444, #ec4899, #8b5cf6)',
          opacity: 0.3,
          filter: 'blur(15px)',
          zIndex: 0
        }} />

        {/* Wheel */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `
            0 0 0 8px rgba(30, 41, 59, 0.9),
            0 0 0 12px rgba(139, 92, 246, 0.5),
            0 20px 50px rgba(0, 0, 0, 0.5)
          `,
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning 
            ? `transform ${spinDuration}ms cubic-bezier(0.2, 0.8, 0.3, 1)` 
            : 'none',
          zIndex: 1
        }}>
          <canvas 
            ref={canvasRef} 
            width={380} 
            height={380}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {/* Result Display */}
      {showResult && winningSegmentData && (
        <div style={{
          marginTop: '40px',
          padding: '24px 40px',
          background: winningSegmentData.isJackpot
            ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
          borderRadius: '20px',
          border: `3px solid ${winningSegmentData.color}`,
          boxShadow: `0 0 30px ${winningSegmentData.color}40`,
          textAlign: 'center',
          animation: 'fadeInUp 0.5s ease-out'
        }}>
          {winningSegmentData.isJackpot && (
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
          )}
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#94a3b8',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            {winningSegmentData.isJackpot ? 'MEGA JACKPOT!' : 'You Won!'}
          </div>
          <div style={{
            fontSize: '42px',
            fontWeight: '800',
            color: winningSegmentData.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <Gift size={36} />
            <span>+{winningSegmentData.xp.toLocaleString()} XP</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// Helper function to darken/lighten color
function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

export default NFTWheel
