import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import GameStage3D from './GameStage3D'
import CanvasLabel3D from './CanvasLabel3D'

function createCoinFaceTexture(face) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  const isHeads = face === 'heads'

  const gradient = ctx.createRadialGradient(170, 130, 20, 256, 256, 250)
  gradient.addColorStop(0, isHeads ? '#fff6bf' : '#fde68a')
  gradient.addColorStop(0.42, isHeads ? '#f7c948' : '#c87916')
  gradient.addColorStop(1, isHeads ? '#a76308' : '#7c2d12')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(256, 256, 244, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = isHeads ? '#fff3a3' : '#fed7aa'
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(256, 256, 212, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = isHeads ? '#8a4f05' : '#451a03'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(256, 256, 162, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = isHeads ? '#5b3405' : '#fff7ad'
  ctx.strokeStyle = isHeads ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 8
  ctx.font = '900 58px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(isHeads ? 'HEADS' : 'TAILS', 256, 176)
  ctx.fillText(isHeads ? 'HEADS' : 'TAILS', 256, 176)

  ctx.font = '900 128px Arial'
  ctx.strokeText(isHeads ? 'H' : 'T', 256, 282)
  ctx.fillText(isHeads ? 'H' : 'T', 256, 282)

  ctx.font = '800 32px Arial'
  ctx.strokeText('BASEHUB', 256, 372)
  ctx.fillText('BASEHUB', 256, 372)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function CoinMesh({ isSpinning, isRevealing, result, onSpinComplete }) {
  const group = useRef(null)
  const revealStart = useRef(null)
  const completeRef = useRef(false)
  const target = result?.toLowerCase() === 'tails' ? Math.PI : 0
  const headsMap = useMemo(() => createCoinFaceTexture('heads'), [])
  const tailsMap = useMemo(() => createCoinFaceTexture('tails'), [])

  useEffect(() => {
    if (isRevealing) {
      revealStart.current = performance.now()
      completeRef.current = false
    } else {
      revealStart.current = null
      completeRef.current = false
    }
  }, [isRevealing, result])

  useFrame((state, delta) => {
    if (!group.current) return
    const g = group.current
    const presentationSpin = isSpinning && result
    g.position.y = Math.sin(state.clock.elapsedTime * 1.7) * 0.045

    if (isSpinning) {
      if (presentationSpin) {
        g.rotation.y = target + Math.sin(state.clock.elapsedTime * 1.45) * 0.78
        g.rotation.x = 0.18 + Math.sin(state.clock.elapsedTime * 2.1) * 0.08
        g.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.07
        return
      }

      g.rotation.y += delta * 14
      g.rotation.x = Math.sin(state.clock.elapsedTime * 8) * 0.22
      g.rotation.z = Math.sin(state.clock.elapsedTime * 5) * 0.08
      return
    }

    if (isRevealing && revealStart.current) {
      const t = Math.min((performance.now() - revealStart.current) / 1750, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      g.rotation.y = ease * (Math.PI * 6 + target)
      g.rotation.x = Math.sin((1 - t) * Math.PI) * 0.48
      g.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.14)
      if (t >= 1 && !completeRef.current) {
        completeRef.current = true
        onSpinComplete?.()
      }
      return
    }

    g.rotation.y += (target - g.rotation.y) * 0.08
    g.rotation.x *= 0.9
    g.rotation.z *= 0.9
    g.scale.setScalar(1)
  })

  const edgePositions = useMemo(() => Array.from({ length: 42 }, (_, i) => i), [])

  return (
    <group ref={group} rotation={[0.12, 0, -0.05]}>
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.28, 1.28, 0.18, 128, 1, false]} />
        <meshStandardMaterial color="#c87916" roughness={0.32} metalness={0.86} />
      </mesh>
      <mesh position={[0, 0, 0.096]}>
        <circleGeometry args={[1.18, 128]} />
        <meshStandardMaterial map={headsMap} roughness={0.24} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0, -0.096]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[1.18, 128]} />
        <meshStandardMaterial map={tailsMap} roughness={0.3} metalness={0.78} />
      </mesh>
      {edgePositions.map((i) => {
        const a = (i / edgePositions.length) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.285, Math.sin(a) * 1.285, 0]} rotation={[0, 0, a]}>
            <boxGeometry args={[0.035, 0.12, 0.19]} />
            <meshStandardMaterial color="#fef08a" roughness={0.38} metalness={0.75} />
          </mesh>
        )
      })}
      <mesh position={[0, 0, 0.112]}>
        <torusGeometry args={[1.19, 0.026, 14, 128]} />
        <meshStandardMaterial color="#fff2a6" roughness={0.26} metalness={0.78} />
      </mesh>
      <mesh position={[0, 0, -0.112]}>
        <torusGeometry args={[1.19, 0.026, 14, 128]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
      </mesh>
      {result && (
        <CanvasLabel3D
          text={result.toUpperCase()}
          position={[0, -1.15, 0.64]}
          scale={[1.35, 0.34, 1]}
          color="#fef3c7"
          background="rgba(15,23,42,0.72)"
        />
      )}
    </group>
  )
}

const Coin3D = ({ isSpinning, isRevealing, result, size = 120, onSpinComplete }) => {
  const compact = size <= 110
  return (
    <GameStage3D compact={compact} active={isSpinning || isRevealing} theme="gold" height={compact ? 190 : 300}>
      <CoinMesh
        isSpinning={isSpinning}
        isRevealing={isRevealing}
        result={result}
        onSpinComplete={onSpinComplete}
      />
    </GameStage3D>
  )
}

export default Coin3D
