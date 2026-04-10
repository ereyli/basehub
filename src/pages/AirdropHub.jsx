import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import {
  Star,
  Flame,
  ChevronDown,
  ChevronUp,
  Zap,
  Search,
  LayoutGrid,
  Loader2,
} from 'lucide-react'
import BackButton from '../components/BackButton'
import EmbedMeta from '../components/EmbedMeta'
import { useRainbowKitSwitchChain } from '../hooks/useRainbowKitSwitchChain'
import { useTransactions } from '../hooks/useTransactions'
import { useDeployToken } from '../hooks/useDeployToken'
import { useDeployERC721 } from '../hooks/useDeployERC721'
import { useDeployERC1155 } from '../hooks/useDeployERC1155'
import {
  HUB_HOT_NETWORK_KEYS,
  getHubModulesForNetwork,
  getHubChainLogoUrl,
  HUB_BATCH_STEP_IDS,
  listHubNetworks,
} from '../config/airdropHub'

const LS_FAV = 'basehub-airdrop-favorites'
const LS_PROGRESS = 'basehub-airdrop-progress'

/** Site-aligned palette (see Home / Swap / Deploy sections) */
const primary = '#3b82f6'
const primaryMuted = 'rgba(59, 130, 246, 0.18)'
const bgCard = 'rgba(15, 23, 42, 0.92)'
const borderSubtle = 'rgba(255,255,255,0.08)'

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Game hooks return `null` on user reject, or `{ txHash: null, ... }` when no hash (e.g. Base app) — treat as aborted, not success. */
function isHubGameTxMissing(res) {
  if (res == null) return true
  if (typeof res === 'object' && Object.prototype.hasOwnProperty.call(res, 'txHash')) {
    const h = res.txHash
    return h == null || h === ''
  }
  return false
}

function isUserRejectedError(err) {
  const msg = (err?.message || err?.shortMessage || String(err || '')).toLowerCase()
  const code = err?.code ?? err?.cause?.code
  return (
    code === 4001 ||
    Number(code) === 4001 ||
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('rejected the request') ||
    msg.includes('denied transaction') ||
    msg.includes('cancelled') ||
    msg.includes('canceled')
  )
}

/** Auto-picks for hub batch (same ranges as game UIs). */
function randomFlipSide() {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}
/** DiceRoll.sol: `guess` must be 1–6 (single die). Same as DiceRollGame.tsx. */
function randomDiceFace() {
  return Math.floor(Math.random() * 6) + 1
}
function randomLuckyGuess() {
  return Math.floor(Math.random() * 10) + 1
}

function NetworkIcon({ network }) {
  const localLogo = getHubChainLogoUrl(network.networkKey)
  const url = localLogo || network.iconUrls?.[0]
  if (url && typeof url === 'string') {
    return (
      <img
        src={url}
        alt=""
        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)' }}
      />
    )
  }
  const letter = (network.chainName || '?').charAt(0).toUpperCase()
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'rgba(59, 130, 246, 0.2)',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 18,
        color: '#e2e8f0',
      }}
    >
      {letter}
    </div>
  )
}

export default function AirdropHub() {
  const navigate = useNavigate()
  const chainId = useChainId()
  const { address, isConnected } = useAccount()
  const { switchChain } = useRainbowKitSwitchChain()
  const {
    sendGMTransaction,
    sendGNTransaction,
    sendFlipTransaction,
    sendDiceRollTransaction,
    sendLuckyNumberTransaction,
  } = useTransactions()
  const { deployToken } = useDeployToken()
  const { deployERC721 } = useDeployERC721()
  const { deployERC1155 } = useDeployERC1155()

  const [netMode, setNetMode] = useState('mainnet')
  const [filterTab, setFilterTab] = useState('all')
  const [search, setSearch] = useState('')
  const [favorites, setFavorites] = useState(() => loadJson(LS_FAV, []))
  const [progressMap, setProgressMap] = useState(() => loadJson(LS_PROGRESS, {}))
  const [expanded, setExpanded] = useState(() => ({}))

  const [runningKey, setRunningKey] = useState(null)
  const [stepHint, setStepHint] = useState('')
  const [batchError, setBatchError] = useState(null)
  /** Last batch result for a card (shown after run stops — avoids spinner with no message). */
  const [hubOutcome, setHubOutcome] = useState(null)

  useEffect(() => {
    saveJson(LS_FAV, favorites)
  }, [favorites])

  useEffect(() => {
    saveJson(LS_PROGRESS, progressMap)
  }, [progressMap])

  const networks = useMemo(() => listHubNetworks(netMode), [netMode])

  const filtered = useMemo(() => {
    let list = networks
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((n) => (n.chainName || '').toLowerCase().includes(q))
    }
    if (filterTab === 'hot') {
      list = list.filter((n) => HUB_HOT_NETWORK_KEYS.has(n.networkKey))
    }
    if (filterTab === 'favorites') {
      list = list.filter((n) => favorites.includes(n.networkKey))
    }
    return list
  }, [networks, search, filterTab, favorites])

  const toggleFavorite = useCallback((networkKey, e) => {
    e.preventDefault()
    e.stopPropagation()
    setFavorites((prev) => {
      const set = new Set(prev)
      if (set.has(networkKey)) set.delete(networkKey)
      else set.add(networkKey)
      return [...set]
    })
  }, [])

  const toggleProgress = useCallback((networkKey, moduleId) => {
    setProgressMap((prev) => {
      const net = { ...(prev[networkKey] || {}) }
      net[moduleId] = !net[moduleId]
      return { ...prev, [networkKey]: net }
    })
  }, [])

  const markModulesDone = useCallback((networkKey, moduleIds) => {
    setProgressMap((prev) => {
      const net = { ...(prev[networkKey] || {}) }
      moduleIds.forEach((id) => {
        net[id] = true
      })
      return { ...prev, [networkKey]: net }
    })
  }, [])

  const goModule = useCallback(
    async (path, targetChainId) => {
      if (targetChainId != null && chainId !== targetChainId) {
        try {
          await switchChain({ chainId: targetChainId })
          await sleep(800)
        } catch (err) {
          console.warn('switchChain', err)
        }
      }
      navigate(path)
    },
    [chainId, navigate, switchChain]
  )

  /**
   * One flow: switch → GM → GN → Flip → Dice → Lucky → three deploys. Games use random auto-picks; Slot is excluded (credits).
   */
  const runAllForNetwork = useCallback(
    async (network) => {
      setBatchError(null)
      setHubOutcome(null)
      if (!isConnected || !address) {
        setBatchError('Connect your wallet first.')
        return
      }

      const modules = getHubModulesForNetwork(network.networkKey)
      if (modules.length === 0) {
        setBatchError('No modules configured for this network.')
        return
      }

      setRunningKey(network.networkKey)
      const doneIds = []
      const tag = `${network.networkKey}-${Date.now().toString(36)}`
      const tokenName = `BaseHub Hub ${tag}`
      const tokenSymbol = `BH${String(network.chainId).slice(-4)}`
      const nftName = `BaseHub NFT ${tag}`
      const multiName = `BaseHub Multi ${tag}`

      try {
        setStepHint('Switching network…')
        if (chainId !== network.chainId) {
          const sw = await switchChain({ chainId: network.chainId })
          if (sw && sw.alreadyProcessing) {
            setHubOutcome({
              networkKey: network.networkKey,
              message: 'Network switch already in progress. Wait a moment and try again.',
              tone: 'error',
            })
            markModulesDone(network.networkKey, doneIds)
            return
          }
          await sleep(1200)
        }

        for (const id of HUB_BATCH_STEP_IDS) {
          if (!modules.some((m) => m.id === id)) continue
          if (id === 'gm') {
            setStepHint('GM — confirm in wallet')
            const res = await sendGMTransaction('GM — Airdrop Hub ⚡')
            if (isHubGameTxMissing(res)) {
              markModulesDone(network.networkKey, doneIds)
              setHubOutcome({
                networkKey: network.networkKey,
                message:
                  res == null
                    ? 'GM cancelled or rejected in wallet.'
                    : 'GM did not complete (no transaction hash). Approve in wallet or try again.',
                tone: 'error',
              })
              return
            }
            doneIds.push('gm')
            continue
          }
          if (id === 'gn') {
            setStepHint('GN — confirm in wallet')
            const res = await sendGNTransaction('GN — Airdrop Hub ⚡')
            if (isHubGameTxMissing(res)) {
              markModulesDone(network.networkKey, doneIds)
              setHubOutcome({
                networkKey: network.networkKey,
                message:
                  res == null
                    ? 'GN cancelled or rejected in wallet.'
                    : 'GN did not complete (no transaction hash). Approve in wallet or try again.',
                tone: 'error',
              })
              return
            }
            doneIds.push('gn')
            continue
          }
          if (id === 'flip') {
            const side = randomFlipSide()
            setStepHint(`Coin flip (${side}) — confirm in wallet`)
            const res = await sendFlipTransaction(side)
            if (isHubGameTxMissing(res)) {
              markModulesDone(network.networkKey, doneIds)
              setHubOutcome({
                networkKey: network.networkKey,
                message:
                  res == null
                    ? 'Coin flip cancelled or rejected in wallet.'
                    : 'Coin flip did not complete (no transaction hash). Approve in wallet or try again.',
                tone: 'error',
              })
              return
            }
            doneIds.push('flip')
            await sleep(400)
            continue
          }
          if (id === 'dice') {
            const g = randomDiceFace()
            setStepHint(`Dice roll (guess ${g}, 1–6) — confirm in wallet`)
            const res = await sendDiceRollTransaction(BigInt(g))
            if (isHubGameTxMissing(res)) {
              markModulesDone(network.networkKey, doneIds)
              setHubOutcome({
                networkKey: network.networkKey,
                message:
                  res == null
                    ? 'Dice roll cancelled or rejected in wallet.'
                    : 'Dice roll did not complete (no transaction hash). Approve in wallet or try again.',
                tone: 'error',
              })
              return
            }
            doneIds.push('dice')
            await sleep(400)
            continue
          }
          if (id === 'lucky') {
            const g = randomLuckyGuess()
            setStepHint(`Lucky number (guess ${g}) — confirm in wallet`)
            const res = await sendLuckyNumberTransaction(BigInt(g))
            if (isHubGameTxMissing(res)) {
              markModulesDone(network.networkKey, doneIds)
              setHubOutcome({
                networkKey: network.networkKey,
                message:
                  res == null
                    ? 'Lucky number cancelled or rejected in wallet.'
                    : 'Lucky number did not complete (no transaction hash). Approve in wallet or try again.',
                tone: 'error',
              })
              return
            }
            doneIds.push('lucky')
            await sleep(400)
            continue
          }
          if (id === 'deploy20') {
            setStepHint('Deploy ERC-20 — confirm in wallet')
            await deployToken(tokenName, tokenSymbol, '1000000000000000000000', 18)
            doneIds.push('deploy20')
            await sleep(500)
            continue
          }
          if (id === 'deploy721') {
            setStepHint('Deploy ERC-721 — confirm in wallet')
            await deployERC721(nftName, 'BH721', null)
            doneIds.push('deploy721')
            await sleep(500)
            continue
          }
          if (id === 'deploy1155') {
            setStepHint('Deploy ERC-1155 — confirm in wallet')
            await deployERC1155(multiName, 'BH1155', 'https://basehub.fun/')
            doneIds.push('deploy1155')
            continue
          }
        }

        setStepHint('Done')
        markModulesDone(network.networkKey, doneIds)
        setHubOutcome({
          networkKey: network.networkKey,
          message: 'All steps completed for this network.',
          tone: 'ok',
        })
      } catch (err) {
        console.error('Airdrop Hub batch', err)
        const rejected = isUserRejectedError(err)
        const msg = err?.shortMessage || err?.message || 'Something went wrong'
        setHubOutcome({
          networkKey: network.networkKey,
          message: rejected ? 'Cancelled or rejected in wallet.' : `Failed: ${msg}`,
          tone: 'error',
        })
        if (!rejected) {
          setBatchError(msg)
        }
        markModulesDone(network.networkKey, doneIds)
      } finally {
        setRunningKey(null)
        setTimeout(() => setStepHint(''), 2800)
      }
    },
    [
      address,
      chainId,
      isConnected,
      markModulesDone,
      sendGMTransaction,
      sendGNTransaction,
      sendFlipTransaction,
      sendDiceRollTransaction,
      sendLuckyNumberTransaction,
      deployToken,
      deployERC721,
      deployERC1155,
      switchChain,
    ]
  )

  const pill = (active) => ({
    padding: '8px 18px',
    borderRadius: 999,
    border: `1px solid ${active ? primary : borderSubtle}`,
    background: active ? primaryMuted : 'rgba(255,255,255,0.04)',
    color: active ? '#93c5fd' : '#94a3b8',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'Poppins, system-ui, sans-serif',
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 48px' }}>
      <EmbedMeta
        title="Airdrop Hub"
        description="Run GM, GN, coin flip, dice, lucky number, and three deploys per chain — auto game picks, same XP as BaseHub."
        url={typeof window !== 'undefined' ? `${window.location.origin}/airdrop-hub` : undefined}
        buttonText="Open Airdrop Hub"
        gameType="hub"
      />

      <BackButton />

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: primaryMuted,
                border: `1px solid rgba(59, 130, 246, 0.35)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LayoutGrid size={22} color={primary} />
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
                color: '#f8fafc',
                fontFamily: 'Poppins, system-ui, sans-serif',
              }}
            >
              Airdrop Hub
            </h1>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, maxWidth: 580, lineHeight: 1.55 }}>
            One run: switch network, then GM, GN, coin flip, dice roll, and lucky number (random picks), then ERC-20 / ERC-721
            / ERC-1155 deploys. Slot and other credit-gated games are not included. Same XP as the main app. Progress is
            stored in this browser only.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button type="button" style={pill(netMode === 'mainnet')} onClick={() => setNetMode('mainnet')}>
            Mainnet
          </button>
          <button type="button" style={pill(netMode === 'testnet')} onClick={() => setNetMode('testnet')}>
            Testnet
          </button>
        </div>
      </div>

      {batchError && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fecaca',
            fontSize: 14,
          }}
        >
          {batchError}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {['all', 'hot', 'favorites'].map((tab) => (
          <button
            key={tab}
            type="button"
            style={pill(filterTab === tab)}
            onClick={() => setFilterTab(tab)}
          >
            {tab === 'all' ? 'All' : tab === 'hot' ? 'Hot' : 'Favourites'}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 200 }} />
        <div style={{ position: 'relative', minWidth: 220, flex: '0 1 280px' }}>
          <Search
            size={16}
            color="#64748b"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="search"
            placeholder="Search networks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 12,
              border: `1px solid ${borderSubtle}`,
              background: 'rgba(0,0,0,0.35)',
              color: '#e2e8f0',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>No networks match.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((network) => {
            const modules = getHubModulesForNetwork(network.networkKey)
            const hot = HUB_HOT_NETWORK_KEYS.has(network.networkKey)
            const isFav = favorites.includes(network.networkKey)
            const isActive = chainId === network.chainId
            const prog = progressMap[network.networkKey] || {}
            const done = modules.filter((m) => prog[m.id]).length
            const total = modules.length
            const exp = expanded[network.networkKey]
            const isRunning = runningKey === network.networkKey
            const anyRunning = runningKey !== null

            return (
              <div
                key={network.networkKey}
                style={{
                  background: bgCard,
                  borderRadius: 18,
                  padding: 16,
                  border: `1px solid ${borderSubtle}`,
                  boxShadow: hot
                    ? '0 0 0 1px rgba(251, 146, 60, 0.4), 0 8px 32px rgba(0,0,0,0.35)'
                    : '0 8px 32px rgba(0,0,0,0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <NetworkIcon network={network} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 16,
                            color: '#f1f5f9',
                            fontFamily: 'Poppins, system-ui, sans-serif',
                          }}
                        >
                          {network.chainName.replace('InkChain', 'Ink')}
                        </span>
                        {hot && <Flame size={16} color="#fb923c" style={{ flexShrink: 0 }} />}
                        {isActive && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: primary,
                              border: `1px solid rgba(59,130,246,0.45)`,
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>ID {network.chainId}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(network.networkKey, e)}
                    aria-label={isFav ? 'Remove favourite' : 'Add favourite'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: isFav ? primary : '#64748b',
                    }}
                  >
                    <Star size={20} fill={isFav ? primary : 'none'} color={isFav ? primary : '#64748b'} strokeWidth={isFav ? 0 : 2} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {modules.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#64748b' }}>No mapped modules yet</span>
                  ) : (
                    modules.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => goModule(m.path, network.chainId)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.35)',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                        }}
                      >
                        {m.label}
                      </button>
                    ))
                  )}
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                      fontSize: 12,
                      color: '#94a3b8',
                    }}
                  >
                    <span>Progress</span>
                    <span style={{ fontWeight: 700, color: '#e2e8f0' }}>
                      {total ? `${done}/${total}` : '—'}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: total ? `${(done / total) * 100}%` : '0%',
                        background: `linear-gradient(90deg, ${primary}, #2563eb)`,
                        borderRadius: 999,
                        transition: 'width 0.25s ease',
                      }}
                    />
                  </div>
                </div>

                {isRunning && stepHint && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#93c5fd',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Loader2 size={14} style={{ animation: 'hubSpin 0.9s linear infinite' }} />
                    {stepHint}
                  </div>
                )}

                {hubOutcome?.networkKey === network.networkKey && !isRunning && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: hubOutcome.tone === 'error' ? '#f87171' : '#86efac',
                      lineHeight: 1.4,
                    }}
                  >
                    {hubOutcome.message}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [network.networkKey]: !prev[network.networkKey] }))
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  Show details
                  {exp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {exp && modules.length > 0 && (
                  <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {modules.map((m) => (
                      <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(prog[m.id])}
                            onChange={() => toggleProgress(network.networkKey, m.id)}
                          />
                          <span style={{ color: '#cbd5e1', fontSize: 13 }}>{m.label}</span>
                        </label>
                        <Link
                          to={m.path}
                          onClick={(e) => {
                            e.preventDefault()
                            goModule(m.path, network.chainId)
                          }}
                          style={{ fontSize: 12, color: primary, fontWeight: 600 }}
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  disabled={anyRunning || !modules.length}
                  onClick={() => runAllForNetwork(network)}
                  style={{
                    marginTop: 'auto',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: `linear-gradient(135deg, ${primary} 0%, #2563eb 100%)`,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: anyRunning || !modules.length ? 'not-allowed' : 'pointer',
                    opacity: anyRunning || !modules.length ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: 'Poppins, system-ui, sans-serif',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  }}
                >
                  {isRunning ? <Loader2 size={18} style={{ animation: 'hubSpin 0.9s linear infinite' }} /> : <Zap size={18} />}
                  {isRunning ? 'Running…' : 'Run all steps'}
                </button>

                <button
                  type="button"
                  disabled={anyRunning}
                  onClick={async () => {
                    try {
                      await switchChain({ chainId: network.chainId })
                    } catch (e) {
                      console.warn(e)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: `1px solid ${borderSubtle}`,
                    background: 'rgba(255,255,255,0.04)',
                    color: '#94a3b8',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: anyRunning ? 'not-allowed' : 'pointer',
                  }}
                >
                  Switch to this network only
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ marginTop: 28, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
        Games and deploys may charge small network / deployer fees (ETH or chain-native). Hub uses auto-generated names so
        you only sign — review fees in your wallet before confirming.
      </p>
      <style>{`
        @keyframes hubSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
