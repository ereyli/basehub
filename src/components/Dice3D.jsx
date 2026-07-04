import React, { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import GameStage3D from './GameStage3D'
import CanvasLabel3D from './CanvasLabel3D'

const FACE_ROTATIONS = {
  1: [0.12, 0.24, -0.08],
  2: [0.12, -Math.PI / 2, -0.08],
  3: [-Math.PI / 2, 0.18, 0.06],
  4: [Math.PI / 2, -0.16, -0.05],
  5: [0.12, Math.PI / 2, 0.08],
  6: [0.12, Math.PI + 0.2, -0.08]
}

function Pip({ x, y, position, rotation }) {
  return (
    <mesh position={position} rotation={rotation}>
      <circleGeometry args={[0.055, 20]} />
      <meshStandardMaterial color="#0f172a" roughness={0.45} />
    </mesh>
  )
}

function Face({ value, position, rotation }) {
  const layouts = {
    1: [[0, 0]],
    2: [[-0.17, -0.17], [0.17, 0.17]],
    3: [[-0.18, -0.18], [0, 0], [0.18, 0.18]],
    4: [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]],
    5: [[-0.18, -0.18], [0.18, -0.18], [0, 0], [-0.18, 0.18], [0.18, 0.18]],
    6: [[-0.18, -0.2], [0.18, -0.2], [-0.18, 0], [0.18, 0], [-0.18, 0.2], [0.18, 0.2]]
  }
  return (
    <group position={position} rotation={rotation}>
      {layouts[value].map(([x, y], i) => (
        <Pip key={i} position={[x, y, 0.012]} rotation={[0, 0, 0]} />
      ))}
    </group>
  )
}

function Die({ value = 1, offset = 0, active, revealing, delay = 0, onDone }) {
  const group = useRef(null)
  const revealStart = useRef(null)
  const doneRef = useRef(false)
  const target = FACE_ROTATIONS[value] || FACE_ROTATIONS[1]

  useEffect(() => {
    if (revealing) {
      revealStart.current = performance.now() + delay
      doneRef.current = false
    } else {
      revealStart.current = null
      doneRef.current = false
    }
  }, [revealing, value, delay])

  useFrame((state, delta) => {
    if (!group.current) return
    const g = group.current
    g.position.y = -0.05 + Math.abs(Math.sin(state.clock.elapsedTime * 3.2 + offset)) * (active ? 0.16 : 0.035)

    if (active && !revealing) {
      g.rotation.x += delta * (7.5 + offset)
      g.rotation.y += delta * (8.8 - offset)
      g.rotation.z += delta * 5.4
      return
    }

    if (revealing && revealStart.current) {
      const raw = (performance.now() - revealStart.current) / 1450
      const t = Math.max(0, Math.min(raw, 1))
      const ease = 1 - Math.pow(1 - t, 3)
      g.rotation.x = target[0] + (1 - ease) * (Math.PI * 4 + offset)
      g.rotation.y = target[1] + (1 - ease) * (Math.PI * 3.5)
      g.rotation.z = target[2] + Math.sin(t * Math.PI) * 0.22
      g.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.12)
      if (t >= 1 && !doneRef.current) {
        doneRef.current = true
        onDone?.()
      }
      return
    }

    g.rotation.x += (target[0] - g.rotation.x) * 0.08
    g.rotation.y += (target[1] - g.rotation.y) * 0.08
    g.rotation.z += (target[2] - g.rotation.z) * 0.08
    g.scale.setScalar(1)
  })

  return (
    <group ref={group} position={[offset, 0, 0]}>
      <RoundedBox args={[1, 1, 1]} radius={0.13} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color="#f8fafc" roughness={0.28} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[1.018, 1.018, 1.018]} radius={0.14} smoothness={5}>
        <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.25} transparent opacity={0.14} />
      </RoundedBox>
      <Face value={1} position={[0, 0, 0.505]} rotation={[0, 0, 0]} />
      <Face value={6} position={[0, 0, -0.505]} rotation={[0, Math.PI, 0]} />
      <Face value={2} position={[0.505, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Face value={5} position={[-0.505, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Face value={3} position={[0, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <Face value={4} position={[0, -0.505, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  )
}

const Dice3D = ({
  isRolling,
  isRevealing,
  dice1,
  dice2,
  onRollComplete,
  compact = false
}) => {
  const [completed, setCompleted] = useState(0)

  useEffect(() => {
    if (isRevealing) setCompleted(0)
  }, [isRevealing])

  const handleDieDone = () => {
    setCompleted((prev) => {
      const next = prev + 1
      if (next >= 2) onRollComplete?.()
      return next
    })
  }

  return (
    <div>
      <GameStage3D compact={compact} active={isRolling || isRevealing} theme="green" height={compact ? 210 : 320}>
        <Die value={dice1 || 1} offset={compact ? -0.72 : -0.95} active={isRolling} revealing={isRevealing} onDone={handleDieDone} />
        <Die value={dice2 || 1} offset={compact ? 0.72 : 0.95} active={isRolling} revealing={isRevealing} delay={120} onDone={handleDieDone} />
        {dice1 && dice2 && (
          <CanvasLabel3D
            text={`TOTAL ${dice1 + dice2}`}
            position={[0, -1.08, 0.72]}
            scale={[1.28, 0.28, 1]}
            color="#d1fae5"
            background="rgba(6,78,59,0.62)"
          />
        )}
      </GameStage3D>
    </div>
  )
}

export default Dice3D
