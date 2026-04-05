import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useBalance, useChainId, usePublicClient, useReadContract } from 'wagmi'
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Send,
  Info,
} from 'lucide-react'
import { formatUnits } from 'viem'
import { NETWORKS } from '../config/networks'
import { useRainbowKitSwitchChain } from '../hooks/useRainbowKitSwitchChain'
import { useTransactions } from '../hooks/useTransactions'
import BackButton from '../components/BackButton'
import EmbedMeta from '../components/EmbedMeta'
import FastDeployButton from '../components/FastDeployButton'

/** USDC on Base mainnet (Guild onchain holding checks) */
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
]

const SECONDS_30D = 30 * 24 * 60 * 60
const BLOCKSCOUT_BASE = 'https://base.blockscout.com/api'

/**
 * Guild onchain: https://guild.xyz/base/onchain
 * Builders contracts: https://guild.xyz/base/builders-founders
 */
function buildOnchainChecks(ctx) {
  const {
    eth,
    usdc,
    totalTx,
    activeInLast30d,
    explorerOk,
  } = ctx

  const holding1 = usdc >= 1 || eth >= 0.0005
  const holding100 = usdc >= 100 || eth >= 0.03
  const holding1000 = eth >= 0.3 || usdc >= 1000
  const txLabel = explorerOk ? `Tx count (Blockscout): ${totalTx}` : `Tx count (fallback): ${totalTx}`

  return [
    {
      id: 'active',
      guildTitle: 'Active on Base',
      description: 'Make at least one transaction on Base in the past 30 days (Guild).',
      completed: activeInLast30d === true,
      detail:
        explorerOk === false
          ? 'Explorer unavailable — connect wallet on Base & refresh.'
          : activeInLast30d
            ? 'Activity in the last 30 days detected.'
            : 'No activity in the last 30 days detected (via explorer).',
    },
    {
      id: 'tx10',
      guildTitle: 'Based: 10 transactions',
      description: 'Claim once you reach 10 transactions on Base (Guild).',
      completed: totalTx >= 10,
      detail: txLabel,
    },
    {
      id: 'tx50',
      guildTitle: 'Based: 50 transactions',
      description: 'Claim once you reach 50 transactions on Base (Guild).',
      completed: totalTx >= 50,
      detail: txLabel,
    },
    {
      id: 'tx100',
      guildTitle: 'Based: 100 transactions',
      description: 'Claim once you reach 100 transactions on Base (Guild).',
      completed: totalTx >= 100,
      detail: txLabel,
    },
    {
      id: 'tx1000',
      guildTitle: 'Based: 1,000 transactions',
      description: 'Claim once you reach 1,000 transactions on Base (Guild).',
      completed: totalTx >= 1000,
      detail: txLabel,
    },
    {
      id: 'hold1',
      guildTitle: 'Holding: $1+',
      description: 'Hold at least 1 USDC or 0.0005 ETH on Base (Guild).',
      completed: holding1,
      detail: `USDC ${usdc.toFixed(4)} · ETH ${eth.toFixed(6)}`,
    },
    {
      id: 'hold100',
      guildTitle: 'Holding: $100+',
      description: 'Hold at least 100 USDC or 0.03 ETH on Base (Guild).',
      completed: holding100,
      detail: `USDC ${usdc.toFixed(2)} · ETH ${eth.toFixed(6)}`,
    },
    {
      id: 'hold1000',
      guildTitle: 'Holding: $1,000+',
      description: 'Hold at least 0.3 ETH or 1,000 USDC on Base (Guild).',
      completed: holding1000,
      detail: `USDC ${usdc.toFixed(2)} · ETH ${eth.toFixed(6)}`,
    },
  ]
}

function buildBuildersChecks(ctx) {
  const { contractsDeployed, explorerOk } = ctx
  return [
    {
      id: 'deploy1',
      guildTitle: 'Contract Deployed: 1',
      description: 'Deployed your first smart contract on Base (Guild — Builders & Founders).',
      completed: contractsDeployed >= 1,
      detail:
        explorerOk === false
          ? 'Explorer unavailable.'
          : `Contracts deployed (estimated): ${contractsDeployed}`,
    },
    {
      id: 'deploy5',
      guildTitle: 'Contracts Deployed: 5',
      description: 'Deployed 5 contracts on Base (Guild).',
      completed: contractsDeployed >= 5,
      detail: `Contracts deployed (estimated): ${contractsDeployed}`,
    },
    {
      id: 'deploy10',
      guildTitle: 'Contracts Deployed: 10+',
      description: 'Deployed 10+ contracts on Base (Guild).',
      completed: contractsDeployed >= 10,
      detail: `Contracts deployed (estimated): ${contractsDeployed}`,
    },
  ]
}

/** Blockscout: tx list (Etherscan-compatible) — outgoing from address */
async function fetchOutgoingTxList(address, page = 1, offset = 10000) {
  const url = `${BLOCKSCOUT_BASE}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc`
  const res = await fetch(url)
  const j = await res.json()
  if (j.status !== '1' || !Array.isArray(j.result)) return []
  return j.result
}

function parseTxTimestamp(tx) {
  const t = tx.timeStamp ?? tx.timestamp
  if (t == null) return null
  return typeof t === 'string' ? parseInt(t, 10) : Number(t)
}

/** Contract creation: outgoing tx with empty `to` and contractAddress set (Etherscan-style) */
function isContractCreation(tx) {
  const to = (tx.to || '').toLowerCase()
  const c = (tx.contractAddress || '').toLowerCase()
  return (!to || to === '0x' || to === '0x0000000000000000000000000000000000000000') && c.startsWith('0x') && c.length === 42
}

/**
 * Try Blockscout v2 for total tx count; fallback to outgoing txlist length (underestimate).
 */
async function fetchExplorerStats(address) {
  let totalTx = 0
  let activeInLast30d = false
  let contractsDeployed = 0
  let explorerOk = false

  try {
    const v2 = await fetch(`https://base.blockscout.com/api/v2/addresses/${address}`)
    if (v2.ok) {
      const j = await v2.json()
      const tc = j.transactions_count ?? j.transaction_count ?? j.counters?.transactions_count
      if (tc != null && tc !== '') totalTx = Number(tc)
      explorerOk = true
    }
  } catch {
    /* ignore */
  }

  try {
    const txs = await fetchOutgoingTxList(address, 1, 10000)
    if (txs.length > 0) explorerOk = true

    const now = Math.floor(Date.now() / 1000)
    for (const tx of txs) {
      const ts = parseTxTimestamp(tx)
      if (ts != null && now - ts <= SECONDS_30D) {
        activeInLast30d = true
        break
      }
    }

    for (const tx of txs) {
      if (isContractCreation(tx)) contractsDeployed += 1
    }

    if (totalTx === 0 && txs.length > 0) {
      totalTx = txs.length
    }
  } catch (e) {
    console.warn('Blockscout txlist:', e)
  }

  /** v2 transactions (from | to) for 30d activity if still false */
  if (!activeInLast30d) {
    try {
      const tr = await fetch(
        `https://base.blockscout.com/api/v2/addresses/${address}/transactions?filter=from%20or%20to`
      )
      if (tr.ok) {
        const j = await tr.json()
        const items = j.items || j.result || []
        explorerOk = true
        const now = Math.floor(Date.now() / 1000)
        for (const it of items.slice(0, 200)) {
          let unix = null
          const raw = it.timestamp ?? it.block_timestamp ?? it.blockTimestamp
          if (typeof raw === 'string' && raw.includes('T')) {
            unix = Math.floor(new Date(raw).getTime() / 1000)
          } else if (raw != null) {
            const t = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw)
            if (Number.isFinite(t)) unix = t > 1e12 ? Math.floor(t / 1000) : t
          }
          if (unix != null && now - unix <= SECONDS_30D) {
            activeInLast30d = true
            break
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { totalTx, activeInLast30d, contractsDeployed, explorerOk }
}

const BaseGuildCompanion = () => {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId: NETWORKS.BASE.chainId })
  const { switchChain } = useRainbowKitSwitchChain()
  const { sendGMTransaction, sendGNTransaction, isLoading: txHookLoading } = useTransactions()

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address,
    chainId: NETWORKS.BASE.chainId,
    query: { enabled: !!address },
  })

  const { data: usdcRaw, refetch: refetchUsdc } = useReadContract({
    address: USDC_BASE,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: NETWORKS.BASE.chainId,
    query: { enabled: !!address },
  })

  const [nonce, setNonce] = useState(null)
  const [explorerStats, setExplorerStats] = useState({
    totalTx: 0,
    activeInLast30d: false,
    contractsDeployed: 0,
    explorerOk: false,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sendingGm, setSendingGm] = useState(false)
  const [sendingGn, setSendingGn] = useState(false)

  const isOnBase = chainId === NETWORKS.BASE.chainId

  const eth = useMemo(() => {
    if (!ethBalance) return 0
    return Number(ethBalance.formatted)
  }, [ethBalance])

  const usdc = useMemo(() => {
    if (usdcRaw == null) return 0
    return Number(formatUnits(usdcRaw, 6))
  }, [usdcRaw])

  const fetchNonce = useCallback(async () => {
    if (!address || !publicClient) return
    try {
      const n = await publicClient.getTransactionCount({ address })
      setNonce(Number(n))
    } catch (e) {
      console.error(e)
      setNonce(0)
    }
  }, [address, publicClient])

  const loadExplorer = useCallback(async () => {
    if (!address) {
      setExplorerStats({ totalTx: 0, activeInLast30d: false, contractsDeployed: 0, explorerOk: false })
      return
    }
    const stats = await fetchExplorerStats(address)
    setExplorerStats(stats)
  }, [address])

  useEffect(() => {
    fetchNonce()
  }, [fetchNonce])

  useEffect(() => {
    loadExplorer()
  }, [loadExplorer])

  const onchainChecks = useMemo(() => {
    const txForMilestones = explorerStats.explorerOk
      ? explorerStats.totalTx
      : (nonce ?? 0)
    return buildOnchainChecks({
      eth,
      usdc,
      totalTx: txForMilestones,
      activeInLast30d: explorerStats.activeInLast30d,
      explorerOk: explorerStats.explorerOk,
    })
  }, [eth, usdc, explorerStats, nonce])

  const buildersChecks = useMemo(
    () =>
      buildBuildersChecks({
        contractsDeployed: explorerStats.contractsDeployed,
        explorerOk: explorerStats.explorerOk,
      }),
    [explorerStats]
  )

  const allChecks = useMemo(() => [...onchainChecks, ...buildersChecks], [onchainChecks, buildersChecks])

  const completedCount = allChecks.filter((c) => c.completed).length
  const progress = allChecks.length ? Math.round((completedCount / allChecks.length) * 100) : 0

  const summaryDone = useMemo(() => allChecks.filter((c) => c.completed), [allChecks])
  const summaryOpen = useMemo(() => allChecks.filter((c) => !c.completed), [allChecks])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([fetchNonce(), refetchEth(), refetchUsdc(), loadExplorer()])
    setIsRefreshing(false)
  }

  const runGm = async () => {
    if (!isConnected) {
      alert('Connect your wallet first')
      return
    }
    setSendingGm(true)
    try {
      await sendGMTransaction('GM from BaseHub! 🎮')
      await handleRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSendingGm(false)
    }
  }

  const runGn = async () => {
    if (!isConnected) {
      alert('Connect your wallet first')
      return
    }
    setSendingGn(true)
    try {
      await sendGNTransaction('GN from BaseHub! 🌙')
      await handleRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSendingGn(false)
    }
  }

  const switchToBase = async () => {
    try {
      await switchChain({ chainId: NETWORKS.BASE.chainId })
    } catch (e) {
      console.error(e)
    }
  }

  const renderRows = (rows) =>
    rows.map((task) => (
      <div
        key={task.id}
        style={{
          background: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', minWidth: 0, flex: 1 }}>
          {task.completed ? <CheckCircle2 size={20} color="#22c55e" style={{ flexShrink: 0 }} /> : <Circle size={20} color="#64748b" style={{ flexShrink: 0 }} />}
          <div>
            <div style={{ color: '#fff', fontWeight: 700 }}>{task.guildTitle}</div>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>{task.description}</div>
            {task.detail && <div style={{ color: '#60a5fa', fontSize: '12px', marginTop: '4px' }}>{task.detail}</div>}
          </div>
        </div>
        <div style={{ fontWeight: 700, color: task.completed ? '#86efac' : '#94a3b8', fontSize: '13px', alignSelf: 'center' }}>
          {task.completed ? 'Done' : 'Open'}
        </div>
      </div>
    ))

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <EmbedMeta
        title="Base Guild — Onchain & Builders"
        description="Guild onchain and contract deploy requirements with Base wallet checks."
      />
      <BackButton />

      <div
        style={{
          background: 'linear-gradient(145deg, rgba(37, 99, 235, 0.16), rgba(15, 23, 42, 0.96))',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderRadius: '16px',
          padding: '20px',
          marginTop: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Shield size={22} color="#60a5fa" />
          <h1 style={{ margin: 0, color: '#fff', fontSize: '22px' }}>Base Guild</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px' }}>
            <a href="https://guild.xyz/base/onchain" target="_blank" rel="noreferrer" style={{ color: '#93c5fd', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Onchain <ExternalLink size={14} />
            </a>
            <a href="https://guild.xyz/base/builders-founders" target="_blank" rel="noreferrer" style={{ color: '#93c5fd', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Builders <ExternalLink size={14} />
            </a>
          </div>
        </div>
        <p style={{ color: '#cbd5e1', margin: '12px 0 0 0', fontSize: '14px' }}>
          Only the <strong>Onchain</strong> roles from{' '}
          <a href="https://guild.xyz/base/onchain" target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
            guild.xyz/base/onchain
          </a>{' '}
          and <strong>contract deploy</strong> roles from{' '}
          <a href="https://guild.xyz/base/builders-founders" target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
            Builders &amp; Founders
          </a>
          . Final verification is always on Guild.
        </p>

        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            background: 'rgba(15,23,42,0.6)',
            borderRadius: '10px',
            border: '1px solid rgba(148,163,184,0.25)',
            color: '#94a3b8',
            fontSize: '12px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}
        >
          <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Holding</strong> uses raw <strong>USDC</strong> and <strong>ETH</strong> on Base (same OR rules as Guild).{' '}
            <strong>Transactions</strong> and <strong>30-day activity</strong> use Base Blockscout where possible; counts may
            differ slightly from Guild’s indexer. <strong>Deploys</strong> are estimated from outgoing txs that created a contract.
          </span>
        </div>

        {!isConnected && <p style={{ color: '#fbbf24', marginTop: '12px' }}>Connect your wallet to run checks.</p>}
        {isConnected && !isOnBase && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ color: '#fca5a5' }}>Switch to Base for balance / USDC checks.</span>
            <button type="button" onClick={switchToBase} style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>
              Switch to Base
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          background: 'rgba(15,23,42,0.75)',
          border: '1px solid rgba(59, 130, 246, 0.22)',
          borderRadius: '14px',
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '17px', fontWeight: 700 }}>Guild Readiness</h2>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '12px', maxWidth: '640px', lineHeight: 1.45 }}>
              Wallet + Blockscout based <strong>estimated</strong> summary. Which roles are likely complete and which are still open in one view.
              Final verification and claim are always on{' '}
              <a href="https://guild.xyz/base/onchain" target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
                Guild
              </a>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              border: '1px solid rgba(96,165,250,0.5)',
              background: 'rgba(59,130,246,0.2)',
              color: '#bfdbfe',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
            Refresh
          </button>
        </div>

        {isConnected && address && !explorerStats.explorerOk && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.28)',
              color: '#fcd34d',
              fontSize: '12px',
            }}
          >
            Explorer is currently limited or unavailable; tx and deploy lines may be incomplete, so re-check on Guild.
          </div>
        )}

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600 }}>Progress (Onchain + deploy)</span>
          <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: '13px' }}>
            {completedCount}/{allChecks.length} · %{progress}
          </span>
        </div>
        <div style={{ marginTop: '8px', height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #22c55e)' }} />
        </div>

        <div
          style={{
            marginTop: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              borderRadius: '10px',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              background: 'rgba(22, 101, 52, 0.12)',
              padding: '12px',
            }}
          >
            <div style={{ color: '#86efac', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
              Likely complete ({summaryDone.length})
            </div>
            {summaryDone.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '12px' }}>No completed roles yet — check tasks below.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.5 }}>
                {summaryDone.map((t) => (
                  <li key={t.id}>{t.guildTitle}</li>
                ))}
              </ul>
            )}
          </div>
          <div
            style={{
              borderRadius: '10px',
              border: '1px solid rgba(248, 113, 113, 0.22)',
              background: 'rgba(127, 29, 29, 0.12)',
              padding: '12px',
            }}
          >
            <div style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
              Open (estimated) ({summaryOpen.length})
            </div>
            {summaryOpen.length === 0 ? (
              <div style={{ color: '#86efac', fontSize: '12px' }}>Everything looks complete — verify on Guild.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.5 }}>
                {summaryOpen.map((t) => (
                  <li key={t.id}>{t.guildTitle}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '12px', marginRight: '4px' }}>Final step:</span>
          <a
            href="https://guild.xyz/base/onchain"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.25)',
              border: '1px solid rgba(96, 165, 250, 0.45)',
              color: '#bfdbfe',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Guild — Onchain <ExternalLink size={14} />
          </a>
          <a
            href="https://guild.xyz/base/builders-founders"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.15)',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              color: '#93c5fd',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Guild — Builders <ExternalLink size={14} />
          </a>
        </div>

        <div style={{ marginTop: '10px', color: '#64748b', fontSize: '12px' }}>
          ETH: {ethBalance ? eth.toFixed(6) : '—'} · USDC: {usdcRaw != null ? usdc.toFixed(2) : '—'} · Tx: {explorerStats.explorerOk ? explorerStats.totalTx : (nonce ?? '—')}
        </div>
      </div>

      <h2 style={{ color: '#e2e8f0', fontSize: '16px', margin: '22px 0 10px 0' }}>Onchain</h2>
      <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 10px 0' }}>Matches guild.xyz/base/onchain</p>
      <div style={{ display: 'grid', gap: '10px' }}>{renderRows(onchainChecks)}</div>

      <h2 style={{ color: '#e2e8f0', fontSize: '16px', margin: '22px 0 10px 0' }}>Builders &amp; Founders — Contracts</h2>
      <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 10px 0' }}>Matches contract deploy roles on guild.xyz/base/builders-founders</p>
      <div
        style={{
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <FastDeployButton compact label="Fast Deploy" />
        <Link
          to="/deploy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(59,130,246,0.45)',
            background: 'rgba(59,130,246,0.18)',
            color: '#bfdbfe',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Deploy ERC20
        </Link>
        <Link
              to="/deploy-erc721"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(6,182,212,0.45)',
                background: 'rgba(6,182,212,0.16)',
                color: '#a5f3fc',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Deploy ERC721
            </Link>
            <Link
              to="/deploy-erc1155"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(139,92,246,0.45)',
                background: 'rgba(139,92,246,0.16)',
                color: '#ddd6fe',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Deploy ERC1155
            </Link>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>{renderRows(buildersChecks)}</div>

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          borderRadius: '14px',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          background: 'rgba(15,23,42,0.85)',
        }}
      >
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '10px' }}>
          Optional: send a GM/GN from BaseHub to add an onchain tx (then Refresh).
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={runGm}
            disabled={!isConnected || sendingGm || sendingGn || txHookLoading}
            style={{
              flex: '1 1 140px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: !isConnected || sendingGm ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: !isConnected || sendingGm ? 0.65 : 1,
            }}
          >
            {sendingGm ? <Loader2 size={16} className="spinning" /> : <Send size={16} />}
            Send GM (tx)
          </button>
          <button
            type="button"
            onClick={runGn}
            disabled={!isConnected || sendingGm || sendingGn || txHookLoading}
            style={{
              flex: '1 1 140px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor: !isConnected || sendingGn ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: !isConnected || sendingGn ? 0.65 : 1,
            }}
          >
            {sendingGn ? <Loader2 size={16} className="spinning" /> : <Send size={16} />}
            Send GN (tx)
          </button>
        </div>
      </div>
    </div>
  )
}

export default BaseGuildCompanion
