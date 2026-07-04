import React, { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import GameStage3D from './GameStage3D'
import CanvasLabel3D from './CanvasLabel3D'

function NumberOrb({ isSpinning, isRevealing, winningNumber, selectedNumber, onSpinComplete }) {
  const group = useRef(null)
  const revealStart = useRef(null)
  const doneRef = useRef(false)
  const [display, setDisplay] = useState(selectedNumber || 1)

  useEffect(() => {
    if (!isSpinning) return undefined
    const interval = setInterval(() => setDisplay(Math.floor(Math.random() * 10) + 1), 90)
    return () => clearInterval(interval)
  }, [isSpinning])

  useEffect(() => {
    if (isRevealing && winningNumber) {
      revealStart.current = performance.now()
      doneRef.current = false
      setDisplay(winningNumber)
    } else {
      revealStart.current = null
      doneRef.current = false
    }
  }, [isRevealing, winningNumber])

  const balls = React.useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const n = i + 1
      const a = (i / 10) * Math.PI * 2
      const row = i % 2 === 0 ? -0.1 : 0.28
      return {
        n,
        x: Math.cos(a) * (0.62 + (i % 3) * 0.11),
        y: row + Math.sin(i * 1.7) * 0.16,
        z: Math.sin(a) * 0.56
      }
    })
  }, [])

  useFrame((state, delta) => {
    if (!group.current) return
    const g = group.current
    g.position.y = Math.sin(state.clock.elapsedTime * 1.8) * 0.035

    if (isSpinning) {
      g.rotation.y += delta * 3.4
      g.rotation.x = Math.sin(state.clock.elapsedTime * 3.2) * 0.08
      return
    }

    if (isRevealing && revealStart.current) {
      const t = Math.min((performance.now() - revealStart.current) / 1450, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      g.rotation.y = (1 - ease) * Math.PI * 6
      g.rotation.x = Math.sin(t * Math.PI) * 0.42
      g.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.16)
      if (t >= 1 && !doneRef.current) {
        doneRef.current = true
        onSpinComplete?.()
      }
      return
    }

    g.rotation.y += delta * 0.22
    g.rotation.x *= 0.92
    g.scale.setScalar(1)
  })

  const highlight = winningNumber || display

  return (
    <group>
      <group ref={group}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.12, 64, 64]} />
          <meshPhysicalMaterial
            color="#c4b5fd"
            roughness={0.05}
            metalness={0.02}
            transmission={0.46}
            transparent
            opacity={0.22}
            thickness={0.5}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.16, 0.03, 14, 128]} />
          <meshStandardMaterial color="#ddd6fe" roughness={0.24} metalness={0.55} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.16, 0.02, 14, 128]} />
          <meshStandardMaterial color="#7dd3fc" roughness={0.3} metalness={0.45} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[1.16, 0.018, 14, 128]} />
          <meshStandardMaterial color="#a78bfa" roughness={0.3} metalness={0.4} />
        </mesh>
        {balls.map(({ n, x, y, z }) => {
          const active = n === highlight
          return (
            <group key={n} position={[x, y, z]} scale={active ? 1.18 : 1}>
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.19, 32, 32]} />
                <meshStandardMaterial color={active ? '#fef3c7' : '#6d28d9'} roughness={0.28} metalness={0.12} emissive={active ? '#f59e0b' : '#1e1b4b'} emissiveIntensity={active ? 0.22 : 0.08} />
              </mesh>
              <CanvasLabel3D
                text={n}
                position={[0, 0, 0.205]}
                scale={[0.28, 0.16, 1]}
                color={active ? '#3b0764' : '#ede9fe'}
                outline={active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.55)'}
                font="800 92px Arial"
              />
            </group>
          )
        })}
      </group>
      <group position={[0, -0.18, 1.16]}>
        <mesh castShadow>
          <sphereGeometry args={[0.44, 48, 48]} />
          <meshStandardMaterial color="#fef3c7" roughness={0.24} metalness={0.14} emissive="#f59e0b" emissiveIntensity={0.12} />
        </mesh>
        <CanvasLabel3D text={display} position={[0, 0.01, 0.47]} scale={[0.58, 0.34, 1]} color="#3b0764" outline="rgba(255,255,255,0.45)" font="900 128px Arial" />
      </group>
      <CanvasLabel3D text={`PICK ${selectedNumber || 1}`} position={[0, -1.03, 0.76]} scale={[0.92, 0.22, 1]} color="#ede9fe" background="rgba(46,16,101,0.62)" font="800 58px Arial" />
    </group>
  )
}

const NumberWheel = ({
  isSpinning,
  isRevealing,
  winningNumber,
  selectedNumber,
  onSpinComplete,
  compact = false
}) => (
  <GameStage3D compact={compact} active={isSpinning || isRevealing} theme="violet" height={compact ? 205 : 315}>
    <NumberOrb
      isSpinning={isSpinning}
      isRevealing={isRevealing}
      winningNumber={winningNumber}
      selectedNumber={selectedNumber}
      onSpinComplete={onSpinComplete}
    />
  </GameStage3D>
)

export default NumberWheel
