import React from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Float } from '@react-three/drei'

const THEMES = {
  gold: {
    glow: 'rgba(245, 158, 11, 0.28)',
    rim: 'rgba(251, 191, 36, 0.24)',
    floor: '#31210c'
  },
  green: {
    glow: 'rgba(16, 185, 129, 0.24)',
    rim: 'rgba(52, 211, 153, 0.2)',
    floor: '#0d2a22'
  },
  violet: {
    glow: 'rgba(139, 92, 246, 0.26)',
    rim: 'rgba(167, 139, 250, 0.22)',
    floor: '#20133b'
  }
}

const GameStage3D = ({
  children,
  compact = false,
  active = false,
  theme = 'gold',
  camera = { position: [0, 2.2, 6.5], fov: 38 },
  height
}) => {
  const palette = THEMES[theme] || THEMES.gold
  const stageHeight = height || (compact ? 190 : 300)

  return (
    <div
      className={`game-stage-3d ${active ? 'is-active' : ''}`}
      style={{
        '--stage-glow': palette.glow,
        '--stage-rim': palette.rim,
        height: stageHeight,
        minHeight: stageHeight
      }}
    >
      <Canvas
        dpr={[1, 1.7]}
        camera={camera}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
      >
        <color attach="background" args={['#050816']} />
        <ambientLight intensity={0.62} />
        <spotLight
          position={[0, 5, 5]}
          angle={0.45}
          penumbra={0.65}
          intensity={active ? 1.95 : 1.35}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 2.4, 2]} intensity={0.85} color="#7dd3fc" />
        <pointLight position={[3, 1.7, -1.5]} intensity={0.65} color="#fef3c7" />
        <Environment preset="city" />
        <group position={[0, -1.18, -1.55]}>
          <mesh receiveShadow>
            <boxGeometry args={[4.7, 0.12, 0.12]} />
            <meshStandardMaterial color="#111827" roughness={0.48} metalness={0.28} />
          </mesh>
          <mesh position={[-2.28, 0, 0.9]} rotation={[0, 0.42, 0]}>
            <boxGeometry args={[0.12, 0.12, 1.9]} />
            <meshStandardMaterial color="#111827" roughness={0.48} metalness={0.28} />
          </mesh>
          <mesh position={[2.28, 0, 0.9]} rotation={[0, -0.42, 0]}>
            <boxGeometry args={[0.12, 0.12, 1.9]} />
            <meshStandardMaterial color="#111827" roughness={0.48} metalness={0.28} />
          </mesh>
        </group>
        <group position={[0, -1.245, 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[1.45, 1.5, 96]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.15} transparent opacity={0.18} />
          </mesh>
          <mesh>
            <ringGeometry args={[2.05, 2.08, 96]} />
            <meshStandardMaterial color="#7dd3fc" roughness={0.32} metalness={0.22} transparent opacity={0.11} />
          </mesh>
        </group>
        <Float speed={1.2} rotationIntensity={0.03} floatIntensity={active ? 0.16 : 0.07}>
          {children}
        </Float>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.32, 0]}>
          <circleGeometry args={[4.2, 72]} />
          <meshStandardMaterial color={palette.floor} roughness={0.78} metalness={0.05} />
        </mesh>
        <ContactShadows
          position={[0, -1.28, 0]}
          opacity={0.42}
          scale={7}
          blur={2.4}
          far={3}
        />
      </Canvas>
    </div>
  )
}

export default GameStage3D
