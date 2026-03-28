import React, { useEffect, useRef, useMemo, useState } from 'react'

const SLOT_META = [
  { label: '3.5K', sub: 'XP', bg: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)', glow: 'rgba(251,191,36,0.5)', text: '#0f172a' },
  { label: '7K', sub: 'XP', bg: 'linear-gradient(180deg, #38bdf8 0%, #0891b2 100%)', glow: 'rgba(34,211,238,0.45)', text: '#0f172a' },
  { label: 'MEGA', sub: '224K XP', bg: 'linear-gradient(180deg, #fb7185 0%, #be123c 100%)', glow: 'rgba(251,113,133,0.55)', text: '#fff' },
  { label: '14K', sub: 'XP', bg: 'linear-gradient(180deg, #a78bfa 0%, #6d28d9 100%)', glow: 'rgba(167,139,250,0.45)', text: '#0f172a' },
  { label: '3.5K', sub: 'XP', bg: 'linear-gradient(180deg, #34d399 0%, #059669 100%)', glow: 'rgba(52,211,153,0.45)', text: '#0f172a' },
]

const NUM_SLOTS = SLOT_META.length
const NUM_ROWS = 12
const PEG_SIZE = 10
const PEG_GAP_Y = 34
const BALL_SIZE = 16
const BOARD_PADDING_X = 28
const BOARD_PADDING_TOP = 22
const ANIM_DURATION = 5800

/** Mulberry32 — deterministic noise from a seed (path looks random but lands on target). */
function mulberry32 (seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let sharedAudioCtx = null
function getAudioContext () {
  if (typeof window === 'undefined') return null
  if (!sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    sharedAudioCtx = new Ctx()
  }
  return sharedAudioCtx
}

/** Short “plink” when the ball hits a peg (stereo-ish via freq). */
function playPegTapSound (rowIndex, pegIndex, hSpacing) {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  const t0 = ctx.currentTime
  const f = 520 + rowIndex * 28 + (pegIndex % 5) * 18 + (rowIndex + pegIndex) % 3 * 12
  const dur = 0.045 + (rowIndex % 4) * 0.004
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f, t0)
  osc.frequency.exponentialRampToValueAtTime(f * 0.65, t0 + dur)
  gain.gain.setValueAtTime(0.11 * Math.min(1, 0.75 + hSpacing / 120), t0)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function buildPegPositions(rows, boardWidth) {
  const lastRowPegs = rows + 1
  const usable = boardWidth - BOARD_PADDING_X * 2
  const hSpacing = usable / (lastRowPegs - 1)
  const allRows = []
  for (let r = 0; r < rows; r++) {
    const count = r + 2
    const rowW = (count - 1) * hSpacing
    const sx = (boardWidth - rowW) / 2
    const y = BOARD_PADDING_TOP + r * PEG_GAP_Y
    const pegs = []
    for (let p = 0; p < count; p++) pegs.push({ x: sx + p * hSpacing, y })
    allRows.push(pegs)
  }
  return { allRows, hSpacing }
}

function computePath (slotIndex, numRows, boardWidth, pathSeed) {
  const rng = mulberry32(pathSeed >>> 0)
  const { allRows, hSpacing } = buildPegPositions(numRows, boardWidth)
  const lastRow = allRows[numRows - 1]
  const gapsCount = lastRow.length - 1
  const slotsPerGap = gapsCount / NUM_SLOTS
  const targetGapCenter = (slotIndex + 0.5) * slotsPerGap
  const targetX = lastRow[0].x + targetGapCenter * hSpacing

  const wobbleAmp = hSpacing * (0.55 + rng() * 0.45)
  const zigFreq = 1.7 + rng() * 1.4
  const driftSign = rng() > 0.5 ? 1 : -1

  const startX = boardWidth / 2 + (rng() - 0.5) * hSpacing * 0.35
  const points = [{ x: startX, y: 0, pr: -1, pp: -1 }]

  let cx = startX
  for (let r = 0; r < numRows; r++) {
    const row = allRows[r]
    const rowY = row[0].y
    const progress = (r + 0.5) / numRows
    // Bias toward slot only in lower ~55% — top feels chaotic, end still lands correctly.
    const late = Math.pow(Math.max(0, progress - 0.38) / 0.62, 1.65)

    let closest = 0
    let closestD = Infinity
    for (let p = 0; p < row.length; p++) {
      const d = Math.abs(row[p].x - cx)
      if (d < closestD) { closestD = d; closest = p }
    }

    const pegX = row[closest].x
    points.push({ x: pegX, y: rowY, pr: r, pp: closest })

    const bias = (targetX - pegX) * 0.42 * late
    const jitter = (rng() - 0.5) * wobbleAmp * (0.75 + rng() * 0.85)
    const zigzag = Math.sin((r + 1) * zigFreq + pathSeed * 0.001) * hSpacing * 0.38 * (1 - late * 0.92)
    const drift = driftSign * Math.sin(r * 0.85 + rng() * 3) * hSpacing * 0.22 * (1 - late * 0.85)
    const sideKick = (rng() - 0.5) * hSpacing * 0.18 * (1 - late)

    let nx = pegX + bias + jitter + zigzag + drift + sideKick

    const half = hSpacing * 0.48
    if (closest === 0) nx = Math.max(pegX, Math.min(pegX + half, nx))
    else if (closest === row.length - 1) nx = Math.max(pegX - half, Math.min(pegX, nx))
    else {
      const lb = row[closest - 1].x + PEG_SIZE
      const rb = row[closest + 1].x - PEG_SIZE
      nx = Math.max(lb, Math.min(rb, nx))
    }

    // Mid-air knot so the polyline isn’t one straight diagonal per row
    const midY = rowY + PEG_GAP_Y * (0.28 + rng() * 0.18)
    const midX = (pegX + nx) / 2 + (rng() - 0.5) * hSpacing * 0.2 * (1 - late)
    points.push({ x: midX, y: midY, pr: -1, pp: -1 })

    points.push({ x: nx, y: rowY + PEG_GAP_Y * 0.58, pr: -1, pp: -1 })
    cx = nx
  }

  points.push({ x: targetX, y: BOARD_PADDING_TOP + numRows * PEG_GAP_Y + 10, pr: -1, pp: -1 })
  return points
}

/** Slow suspense at top, flowing middle, soft landing. */
function easePlinkoDrop (t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  if (t < 0.42) {
    const u = t / 0.42
    return u * u * u * 0.38
  }
  if (t < 0.78) {
    const u = (t - 0.42) / 0.36
    return 0.38 + (1 - Math.cos(u * Math.PI)) * 0.5 * 0.5
  }
  const u = (t - 0.78) / 0.22
  return 0.88 + (1 - Math.pow(1 - u, 3)) * 0.12
}

function lerp (a, b, t) { return a + (b - a) * t }

const NFTPlinkoBoard = ({ targetSlot, isAnimating, onAnimationEnd }) => {
  const boardRef = useRef(null)
  const [boardWidth, setBoardWidth] = useState(600)

  // All animation state lives in refs to avoid re-render loops
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const endCalledRef = useRef(false)
  const onEndRef = useRef(onAnimationEnd)
  const pathRef = useRef(null)
  const animatingRef = useRef(false)
  const pathSeedRef = useRef(0x9e3779b9)
  const lastPegSoundKeyRef = useRef('')

  // These are the only state that triggers visual updates
  const [ballPos, setBallPos] = useState(null)
  const [litPegs, setLitPegs] = useState({})
  const [landed, setLanded] = useState(false)

  // Keep onAnimationEnd ref fresh without triggering re-renders
  useEffect(() => { onEndRef.current = onAnimationEnd }, [onAnimationEnd])

  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setBoardWidth(e.contentRect.width)
    })
    ro.observe(el)
    setBoardWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  const { allRows, hSpacing } = useMemo(() => buildPegPositions(NUM_ROWS, boardWidth), [boardWidth])
  const boardHeight = BOARD_PADDING_TOP + NUM_ROWS * PEG_GAP_Y + 24

  // The animation loop — reads only from refs, no React deps
  function tick () {
    const path = pathRef.current
    const start = startRef.current
    if (!path || !start || !animatingRef.current) return

    const elapsed = performance.now() - start
    const t = Math.min(elapsed / ANIM_DURATION, 1)
    const eased = easePlinkoDrop(t)

    const segs = path.length - 1
    const pos = eased * segs
    const si = Math.min(Math.floor(pos), segs - 1)
    const st = pos - si
    const a = path[si]
    const b = path[si + 1]

    setBallPos({ x: lerp(a.x, b.x, st), y: lerp(a.y, b.y, st) })

    if (b.pr >= 0 && b.pp >= 0 && st > 0.48 && st < 0.92) {
      const key = `${b.pr}-${b.pp}`
      if (lastPegSoundKeyRef.current !== key) {
        lastPegSoundKeyRef.current = key
        playPegTapSound(b.pr, b.pp, hSpacing)
      }
      setLitPegs((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
    }

    if (t >= 1) {
      animatingRef.current = false
      setLanded(true)
      if (!endCalledRef.current) {
        endCalledRef.current = true
        setTimeout(() => {
          if (typeof onEndRef.current === 'function') onEndRef.current()
        }, 500)
      }
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // Start / stop animation when props change
  useEffect(() => {
    if (isAnimating && targetSlot != null && boardWidth > 0) {
      pathSeedRef.current = (Math.random() * 0xffffffff) >>> 0
      lastPegSoundKeyRef.current = ''
      const path = computePath(targetSlot, NUM_ROWS, boardWidth, pathSeedRef.current)
      pathRef.current = path
      endCalledRef.current = false
      animatingRef.current = true
      setLanded(false)
      setLitPegs({})
      const startX = path[0]?.x ?? boardWidth / 2
      setBallPos({ x: startX, y: 0 })
      startRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    }

    if (!isAnimating) {
      animatingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      startRef.current = null
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // Only re-run when these specific props change — NOT on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating, targetSlot, boardWidth])

  // Clean up visuals when fully reset
  useEffect(() => {
    if (!isAnimating && targetSlot == null) {
      setBallPos(null)
      setLitPegs({})
      setLanded(false)
    }
  }, [isAnimating, targetSlot])

  const lastRow = allRows[NUM_ROWS - 1]
  const slotW = lastRow ? (lastRow[lastRow.length - 1].x - lastRow[0].x) / NUM_SLOTS : 80

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        margin: '0 auto',
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgba(34,211,238,0.25)',
        boxShadow: '0 0 32px rgba(34,211,238,0.08), inset 0 0 60px rgba(15,23,42,0.85)',
        background: `
          radial-gradient(ellipse 80% 40% at 50% 0%, rgba(34,211,238,0.10), transparent 55%),
          linear-gradient(180deg, #0f172a 0%, #134e4a 40%, #0f172a 100%)
        `,
      }}
    >
      <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
        <span
          style={{
            fontFamily: 'Poppins, system-ui, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(1.3rem, 4vw, 1.9rem)',
            letterSpacing: '0.16em',
            background: 'linear-gradient(90deg, #22d3ee, #38bdf8, #22d3ee)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.35))',
          }}
        >
          PLINKO
        </span>
      </div>

      <div ref={boardRef} style={{ position: 'relative', width: '100%', height: boardHeight }}>
        {allRows.map((row, rIdx) =>
          row.map((peg, pIdx) => {
            const lit = !!litPegs[`${rIdx}-${pIdx}`]
            return (
              <div
                key={`p-${rIdx}-${pIdx}`}
                style={{
                  position: 'absolute',
                  left: peg.x - PEG_SIZE / 2,
                  top: peg.y - PEG_SIZE / 2,
                  width: PEG_SIZE,
                  height: PEG_SIZE,
                  borderRadius: '50%',
                  background: lit
                    ? 'radial-gradient(circle at 35% 30%, #fff, #22d3ee 55%, #0891b2)'
                    : 'radial-gradient(circle at 35% 30%, #f1f5f9, #94a3b8 55%, #475569)',
                  boxShadow: lit
                    ? '0 0 12px rgba(34,211,238,0.9), 0 0 4px rgba(34,211,238,0.6)'
                    : '0 0 5px rgba(34,211,238,0.25), inset 0 -1px 3px rgba(0,0,0,0.3)',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
              />
            )
          })
        )}

        {ballPos && (
          <div
            style={{
              position: 'absolute',
              left: ballPos.x - BALL_SIZE / 2,
              top: ballPos.y - BALL_SIZE / 2,
              width: BALL_SIZE,
              height: BALL_SIZE,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #fff 0%, #22d3ee 35%, #0891b2 90%)',
              boxShadow: '0 0 14px rgba(34,211,238,0.9), 0 0 4px rgba(255,255,255,0.4)',
              zIndex: 10,
              willChange: 'transform, left, top',
              transition: 'none',
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
          padding: '6px 14px 14px',
          borderTop: '1px solid rgba(34,211,238,0.1)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.3), rgba(15,23,42,0.6))',
        }}
      >
        {SLOT_META.map((slot, i) => {
          const active = landed && targetSlot === i
          return (
            <div
              key={i}
              style={{
                width: Math.max(slotW - 4, 60),
                textAlign: 'center',
                borderRadius: 10,
                padding: '10px 4px',
                background: slot.bg,
                border: active ? '2px solid rgba(255,255,255,0.95)' : '1px solid rgba(15,23,42,0.15)',
                boxShadow: active ? `0 0 24px ${slot.glow}, 0 0 8px ${slot.glow}` : 'inset 0 1px 0 rgba(255,255,255,0.2)',
                transform: active ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.3s, box-shadow 0.3s, border 0.3s',
              }}
            >
              <div style={{ fontSize: 'clamp(11px, 2vw, 14px)', fontWeight: 800, color: slot.text, lineHeight: 1.15, textShadow: slot.text === '#fff' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}>
                {slot.label}
              </div>
              <div style={{ fontSize: 'clamp(8px, 1.4vw, 10px)', fontWeight: 600, color: slot.text === '#fff' ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.7)' }}>
                {slot.sub}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default NFTPlinkoBoard
