import React from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Float } from '@react-three/drei'

const THEMES = {
  gold: {
    glow: 'rgba(245, 158, 11, 0.28)',
    rim: 'rgba(251, 191, 36, 0.24)',
    floor: '#31210c',
    rail: '#1f2937',
    accent: '#f59e0b'
  },
  green: {
    glow: 'rgba(16, 185, 129, 0.24)',
    rim: 'rgba(52, 211, 153, 0.2)',
    floor: '#0d2a22',
    rail: '#29170b',
    accent: '#34d399'
  },
  violet: {
    glow: 'rgba(139, 92, 246, 0.26)',
    rim: 'rgba(167, 139, 250, 0.22)',
    floor: '#20133b',
    rail: '#1e1b4b',
    accent: '#a78bfa'
  }
}

function ThemeProps({ theme, palette }) {
  if (theme === 'gold') {
    return (
      <group position={[0, -1.13, 0.02]}>
        {[-1.62, 1.62].map((x, side) => (
          <group key={x} position={[x, 0, 0.68]} rotation={[0, side ? -0.15 : 0.15, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[i * 0.11 - 0.11, i * 0.025, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.045, 32]} />
                <meshStandardMaterial color={i % 2 ? '#f8fafc' : palette.accent} roughness={0.36} metalness={0.28} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    )
  }

  if (theme === 'green') {
    return (
      <group position={[0, -1.105, 0.14]}>
        {[-1.32, 0, 1.32].map((x) => (
          <mesh key={x} position={[x, 0, 0.72]} rotation={[0, 0, 0]} receiveShadow>
            <boxGeometry args={[0.028, 0.035, 2.15]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.8} metalness={0.02} transparent opacity={0.18} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, -0.22]} receiveShadow>
          <boxGeometry args={[3.35, 0.08, 0.1]} />
          <meshStandardMaterial color="#5b3417" roughness={0.66} metalness={0.05} />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[0, -1.12, 0.12]}>
      <mesh position={[0, 0, 0.72]} receiveShadow>
        <torusGeometry args={[1.34, 0.035, 12, 96]} />
        <meshStandardMaterial color={palette.accent} roughness={0.25} metalness={0.45} transparent opacity={0.62} />
      </mesh>
      <mesh position={[0, -0.005, 0.72]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[0.34, 1.22, 96]} />
        <meshStandardMaterial color="#c4b5fd" roughness={0.42} metalness={0.12} transparent opacity={0.11} />
      </mesh>
    </group>
  )
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
            <meshStandardMaterial color={palette.rail} roughness={0.48} metalness={0.28} />
          </mesh>
          <mesh position={[-2.28, 0, 0.9]} rotation={[0, 0.42, 0]}>
            <boxGeometry args={[0.12, 0.12, 1.9]} />
            <meshStandardMaterial color={palette.rail} roughness={0.48} metalness={0.28} />
          </mesh>
          <mesh position={[2.28, 0, 0.9]} rotation={[0, -0.42, 0]}>
            <boxGeometry args={[0.12, 0.12, 1.9]} />
            <meshStandardMaterial color={palette.rail} roughness={0.48} metalness={0.28} />
          </mesh>
        </group>
        <ThemeProps theme={theme} palette={palette} />
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
