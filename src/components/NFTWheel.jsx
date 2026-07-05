import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Trophy, Gift } from 'lucide-react'
import soundManager from '../utils/soundEffects'

// Wheel segments with their properties (visual order - 224K jackpot at top)
// Reduced by 30% from original values
const DEFAULT_SEGMENTS = [
  { id: 6, xp: 224000, label: '224K', color: '#fbbf24', rarity: 'Jackpot', rarityColor: '#facc15', isJackpot: true },
  { id: 0, xp: 3500, label: '3.5K', color: '#3b82f6', rarity: 'Common', rarityColor: '#60a5fa' },
  { id: 1, xp: 7000, label: '7K', color: '#10b981', rarity: 'Uncommon', rarityColor: '#34d399' },
  { id: 2, xp: 14000, label: '14K', color: '#8b5cf6', rarity: 'Rare', rarityColor: '#a78bfa' },
  { id: 3, xp: 28000, label: '28K', color: '#ec4899', rarity: 'Epic', rarityColor: '#f472b6' },
  { id: 4, xp: 56000, label: '56K', color: '#06b6d4', rarity: 'Mythic', rarityColor: '#22d3ee' },
  { id: 5, xp: 112000, label: '112K', color: '#ef4444', rarity: 'Legendary', rarityColor: '#fb7185' }
]

function playWheelTick(index = 0) {
  soundManager.playWheelTick(index)
}

const NFTWheel = ({ 
  isSpinning, 
  winningSegment, 
  onSpinComplete,
  segments = DEFAULT_SEGMENTS,
  previewSpin = false
}) => {
  const [rotation, setRotation] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const canvasRef = useRef(null)
  const tickRef = useRef(null)
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
        gradient.addColorStop(0, segment.rarityColor || segment.color)
        gradient.addColorStop(0.72, segment.color)
        gradient.addColorStop(1, adjustColor(segment.color, -34))
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

      ctx.beginPath()
      ctx.arc(center, center, radius - 7, startAngle + 0.025, endAngle - 0.025)
      ctx.strokeStyle = segment.rarityColor || segment.color
      ctx.lineWidth = segment.isJackpot ? 10 : 7
      ctx.shadowColor = segment.rarityColor || segment.color
      ctx.shadowBlur = segment.isJackpot ? 10 : 5
      ctx.stroke()
      ctx.shadowBlur = 0

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
      console.log('🎰 NFTWheel: Starting spin animation for segment ID:', winningSegment)
      setShowResult(false)
      
      // Find visual index of winning segment in the segments array
      const visualIndex = segments.findIndex(seg => seg.id === winningSegment)
      if (visualIndex === -1) {
        console.error('❌ NFTWheel: Winning segment not found:', winningSegment, 'in segments:', segments.map(s => s.id))
        return
      }

      const winningSegmentData = segments[visualIndex]
      console.log('🎯 NFTWheel: Winning segment:', winningSegmentData.label, '(', winningSegmentData.xp, 'XP) at visual index:', visualIndex)

      // Calculate rotation to land on the winning segment
      // The wheel is drawn with segment 0 starting at the TOP (12 o'clock position)
      // Canvas draws from -90 degrees, so segment 0 is at top
      // Pointer is at the TOP
      
      const spins = 5 // Number of full rotations for dramatic effect
      
      // Calculate where the segment center is (from top, going clockwise)
      const segmentCenterFromTop = visualIndex * segmentAngle + segmentAngle / 2
      
      // To bring this segment to top, we rotate the wheel clockwise
      // Final rotation should put the winning segment's center at 0 degrees (top)
      const targetRotation = spins * 360 + (360 - segmentCenterFromTop)
      
      console.log('🔄 NFTWheel: Segment', visualIndex, 'center at', segmentCenterFromTop.toFixed(1), '° from top')
      console.log('🔄 NFTWheel: Rotating wheel by', targetRotation.toFixed(1), '° to land on', winningSegmentData.label)
      
      // Normalize previous rotation to avoid accumulating huge numbers
      setRotation(prev => {
        const normalizedPrev = prev % 360
        return normalizedPrev + targetRotation
      })

      // Show result after spin animation completes (spinDuration = 4000ms)
      const resultTimer = setTimeout(() => {
        console.log('✅ NFTWheel: Spin complete, showing result:', winningSegmentData.label, winningSegmentData.xp, 'XP')
        soundManager.playWheelStop(winningSegmentData?.isJackpot)
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

  useEffect(() => {
    if (!isSpinning) {
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = null
      return undefined
    }
    let count = 0
    let delay = 74
    const schedule = () => {
      playWheelTick(count++)
      delay = Math.min(360, Math.round(delay * 1.13 + 3))
      tickRef.current = setTimeout(schedule, delay)
    }
    tickRef.current = setTimeout(schedule, delay)
    return () => {
      if (tickRef.current) clearTimeout(tickRef.current)
      tickRef.current = null
    }
  }, [isSpinning])

  // Reset rotation when winningSegment becomes null (after result is shown)
  useEffect(() => {
    if (winningSegment === null && !isSpinning) {
      console.log('🔄 NFTWheel: Resetting for next spin')
      setShowResult(false)
      // Reset rotation to 0 for next spin (with no transition)
      setIsResetting(true)
      setRotation(0)
      // Allow a brief moment for the reset before enabling transitions again
      const resetTimer = setTimeout(() => {
        setIsResetting(false)
      }, 50)
      return () => clearTimeout(resetTimer)
    }
  }, [winningSegment, isSpinning])

  const winningSegmentData = winningSegment !== null 
    ? segments.find(s => s.id === winningSegment) 
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'clamp(22px, 5vw, 40px) 12px'
    }}>
      {/* Wheel Container */}
      <div style={{
        position: 'relative',
        width: 'min(340px, 70vw)',
        height: 'min(340px, 70vw)',
        maxWidth: '340px',
        maxHeight: '340px',
        transform: isSpinning ? 'translateZ(0) scale(1.01)' : 'translateZ(0)',
        transition: 'transform 280ms ease'
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

        <div style={{
          position: 'absolute',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fef3c7, #f59e0b)',
          boxShadow: '0 0 16px rgba(245, 158, 11, 0.65)',
          zIndex: 21
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

        <div style={{
          position: 'absolute',
          inset: '-28px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.16), transparent 30%), radial-gradient(circle, rgba(15,23,42,0) 52%, rgba(15,23,42,0.72) 72%)',
          pointerEvents: 'none',
          zIndex: 2
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
          transform: previewSpin ? undefined : `rotate(${rotation}deg)`,
          animation: previewSpin ? 'wheelPreviewSpin 9s linear infinite' : 'none',
          transition: (isSpinning && !isResetting && !previewSpin)
            ? `transform ${spinDuration}ms cubic-bezier(0.08, 0.72, 0.03, 1)`
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
            color: winningSegmentData.rarityColor || '#94a3b8',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            {winningSegmentData.isJackpot ? 'MEGA JACKPOT!' : `${winningSegmentData.rarity || 'Reward'} Drop`}
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
        @keyframes wheelPreviewSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
