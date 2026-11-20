import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, Search } from 'lucide-react'
import BackButton from '../components/BackButton'
import AirdropHubNav from '../components/AirdropHubNav'
import EmbedMeta from '../components/EmbedMeta'
import { AIRDROP_POOL, TOKEN_SUPPLY, ASSUMED_ELIGIBLE_WALLETS, ASSUMED_AVERAGE_SCORE, MODEL_VERSION, SOURCES, estimateAllocation } from '../features/airdrop/model'
import './BaseAirdropCheck.css'

const ADDRESS = /^0x[\da-f]{40}$/i
const SCAN_RETRIES = 2
const SNAPSHOT_KEY = `basehub-airdrop-verified:${MODEL_VERSION}`
const whole = (number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number)
const decimal = (number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(number)
const short = (value) => `${value.slice(0, 8)}…${value.slice(-6)}`
const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—'
const STATUS = { met: 'Matched', missed: 'Below threshold', unknown: 'Unresolved', na: 'Not applicable' }
const EVIDENCE = [
  ['x402', 'x402 settlements', 'Tracked ERC-3009 merchant payments and supported x402 proxy settlements.'],
  ['rwa', 'Stocks and other RWAs', 'Wallet activity involving Coinbase stock tokens or supported Spiko fund shares.'],
  ['b20', 'Native B20', 'Factory or launch events and actively used native token contracts.'],
  ['bridge', 'Base bridge', 'Standard bridge finalization events for this recipient.'],
  ['defi', 'Lending and liquidity', 'Actions identified through tracked addresses and events.'],
  ['wallet', 'Smart accounts', 'Sponsored ERC-4337 operations found in indexed transactions.'],
  ['build', 'Builder activity', 'Direct contract creation and ERC-8004 registrations.'],
  ['received', 'Passive RWA receipts', 'Shown for context. Incoming receipts without supported wallet activity earn no points.'],
]

function waitForScanRetry(response, signal) {
  const seconds = Number(response.headers.get('Retry-After')) || 3
  const delay = Math.min(10_000, Math.max(1000, seconds * 1000)) + Math.random() * 1000
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const stop = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop)
      resolve()
    }, delay)
    signal.addEventListener('abort', stop, { once: true })
  })
}

function Status({ value }) {
  return <span className={`bac-badge bac-${value}`}>{STATUS[value]}</span>
}

function readVerifiedEstimate(address) {
  try {
    const snapshot = JSON.parse(localStorage.getItem(`${SNAPSHOT_KEY}:${address}`))
    return snapshot?.address === address && Number.isFinite(snapshot.score) && Number.isSafeInteger(snapshot.block) ? snapshot : null
  } catch {
    return null
  }
}

function keepVerifiedEstimate(result, previous) {
  if (!result.coverage.estimateReady || !Number.isFinite(result.score.total) || previous?.block >= result.block) return previous
  const snapshot = {
    address: result.address, block: result.block, asOf: result.asOf,
    score: result.score.total, hasHistory: result.metrics.transactions > 0,
  }
  try {
    localStorage.setItem(`${SNAPSHOT_KEY}:${snapshot.address}`, JSON.stringify(snapshot))
  } catch {
    // The current result remains usable when browser storage is disabled.
  }
  return snapshot
}

function ActivityChart({ result }) {
  const counts = new Map((result.monthlyActivity ?? []).map(({ month, actions }) => [month, actions]))
  const end = new Date(result.asOf)
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + index, 1))
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }),
      full: date.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    }
  }).map((month) => ({ ...month, actions: counts.get(month.key) ?? 0 }))
  const maximum = Math.max(...months.map(({ actions }) => actions), 1)
  const step = 10 ** Math.floor(Math.log10(maximum))
  const scale = Math.ceil(maximum / step) * step
  const observed = months.reduce((sum, { actions }) => sum + actions, 0)
  const unavailable = !Array.isArray(result.monthlyActivity) || (!result.coverage.activityComplete && !result.metrics.transactions)
  return (
    <section className="bac-panel bac-activity">
      <div className="bac-heading">
        <div><h2>Wallet activity</h2><p>Verified actions by month · last 12 months</p></div>
        {!unavailable && <strong className="bac-chart-total">{whole(observed)}</strong>}
      </div>
      {unavailable ? <p className="bac-chart-empty">Monthly activity is unavailable for this scan.</p> : (
        <div className="bac-chart" role="group" aria-label="Wallet actions by month">
          <div className="bac-chart-axis" aria-hidden="true"><span>{whole(scale)}</span><span>{decimal(scale / 2)}</span><span>0</span></div>
          <div className="bac-chart-grid">
            {months.map(({ key, label, full, actions }) => (
              <div className="bac-chart-month" key={key}>
                <div className="bac-chart-slot" role="img" tabIndex={0} aria-label={`${full}: ${whole(actions)} verified actions`}>
                  <span style={{ '--bar-height': `${100 * actions / scale}%` }} />
                </div>
                <small aria-hidden="true">{label}</small>
                <span className="bac-chart-tooltip" aria-hidden="true">{full} · {whole(actions)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!unavailable && !result.coverage.activityComplete && <p className="bac-chart-caption">Partial scan. Monthly counts are minimums based on verified records.</p>}
    </section>
  )
}

function Score({ result }) {
  const { score, coverage } = result
  const noScore = !coverage.estimateReady || !Number.isFinite(score.total)
  return (
    <section className="bac-panel bac-score-panel">
      <div className="bac-heading">
        <div>
          <h2>Base activity score</h2>
          <p>BaseHub activity model v{result.version}</p>
        </div>
        <span className="bac-score">{noScore ? '—' : score.total}<small>/ 100</small></span>
      </div>
      <div className="bac-dimensions">
        {score.dimensions.map(({ name, points, max, detail }) => (
          <div key={name} className="bac-dimension">
            <div title={detail}><strong>{name}</strong><span>{noScore ? '—' : decimal(points)} / {max}</span></div>
            {!noScore && <progress max={max} value={points} aria-label={name}>{points} of {max}</progress>}
          </div>
        ))}
      </div>
    </section>
  )
}

function Allocation({ result, verified, loading }) {
  const quantity = estimateAllocation(verified?.score, ASSUMED_ELIGIBLE_WALLETS, 'weighted', ASSUMED_AVERAGE_SCORE)
  const quantityLabel = !verified?.hasHistory || quantity == null ? '—' : quantity > 0 && quantity < 1 ? '<1' : whole(quantity)
  const current = result?.coverage.estimateReady && verified?.block === result.block && verified?.score === result.score.total
  let status = 'Estimate unavailable while scan data is incomplete.'
  if (loading) status = 'Verifying wallet activity…'
  else if (current) status = verified.hasHistory ? 'Simulated amount based on verified scan data.' : 'No wallet actions were verified in this scan.'
  else if (verified) status = `Last verified estimate · block ${whole(verified.block)} · ${dateLabel(verified.asOf)} UTC`
  return (
    <section className="bac-panel bac-allocation" aria-labelledby="bac-allocation-title">
      <div className="bac-allocation-main">
        <div>
          <h2 id="bac-allocation-title">Estimated BASE allocation</h2>
          <div className="bac-amount" aria-live="polite">
            {loading && !verified ? <span className="bac-amount-skeleton" aria-hidden="true" /> : <strong>{quantityLabel}</strong>}
            <span className="bac-amount-unit">BASE</span>
          </div>
          <p className="bac-allocation-status" role="status">{status}</p>
        </div>
        <dl className="bac-allocation-inputs">
          <div><dt>Assumed total supply</dt><dd>{whole(TOKEN_SUPPLY)}</dd></div>
          <div><dt>Assumed airdrop pool · 10%</dt><dd>{whole(AIRDROP_POOL)}</dd></div>
        </dl>
      </div>
      <div className="bac-details bac-method">
        <details>
          <summary><span>How the estimate is calculated</span></summary>
          <p>The assumed pool is weighted by your activity score and normalized using {whole(ASSUMED_ELIGIBLE_WALLETS)} assumed eligible addresses with an average score of {ASSUMED_AVERAGE_SCORE}/100. A real allocation could be zero.</p>
        </details>
      </div>
      {loading && <div className="bac-scan-track" aria-hidden="true"><span /></div>}
    </section>
  )
}

function HistoricalRules({ rules }) {
  return (
    <section className="bac-panel">
      <div className="bac-heading"><div><h2>Historical rule matches</h2><p>Past rules applied to this address’s Base activity. The dates below refer to the original distributions.</p></div></div>
      <div className="bac-details">
        {rules.map((rule) => (
          <details key={rule.id}>
            <summary><span>{rule.name} <small>{dateLabel(rule.snapshot)}</small></span><Status value={rule.status} /></summary>
            <p>{rule.summary}</p>
            <ul className="bac-criteria">
              {rule.criteria.map((criterion) => (
                <li key={criterion.label}><span>{criterion.label}<small>{criterion.measured}</small></span><Status value={criterion.status} /></li>
              ))}
            </ul>
            <a className="bac-link" href={rule.source} target="_blank" rel="noreferrer">Original rules <ExternalLink size={13} /></a>
          </details>
        ))}
      </div>
    </section>
  )
}

function Evidence({ result }) {
  const total = Object.values(result.evidence).reduce((sum, entries) => sum + entries.length, 0)
  return (
    <section className="bac-panel">
      <div className="bac-heading"><div><h2>Onchain evidence</h2><p>Open a signal to inspect up to 8 recent transactions.</p></div></div>
      {!total && <p className="bac-note">No supported events were verified in this scan.</p>}
      <div className="bac-details">
        {EVIDENCE.map(([key, label, detail]) => {
          const records = result.evidence[key] ?? []
          return (
            <details key={key}>
              <summary><span>{label}</span><span className="bac-badge">{records.length === 8 ? '8+ shown' : records.length || 'None observed'}</span></summary>
              <p>{detail}</p>
              {records.map(({ hash, timestamp, detail: action }) => (
                <a key={hash} className="bac-evidence" href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer">
                  <span>{action}<small>{dateLabel(timestamp)} · {short(hash)}</small></span><ExternalLink size={14} />
                </a>
              ))}
            </details>
          )
        })}
      </div>
    </section>
  )
}

export default function BaseAirdropCheck() {
  const [params, setParams] = useSearchParams()
  const linkedAddress = params.get('address') ?? ''
  const [address, setAddress] = useState(linkedAddress)
  const [result, setResult] = useState(null)
  const [verified, setVerified] = useState(null)
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)
  const lastVerified = useRef(null)
  const scanAddress = useCallback(async (value) => {
    const normalized = value.trim().toLowerCase()
    if (!ADDRESS.test(normalized) || /^0x0{40}$/i.test(normalized)) {
      setError('Enter a valid, non-zero Base wallet address.')
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const query = new URLSearchParams({ address: normalized })
    setLoading(true)
    setRetrying(false)
    setError('')
    setResult(null)
    const previous = lastVerified.current?.address === normalized ? lastVerified.current : readVerifiedEstimate(normalized)
    setVerified(previous)
    try {
      const url = `/api/base-airdrop-check?${query}`
      let response = await fetch(url, { signal: controller.signal })
      for (let attempt = 0; response.status === 429 && attempt < SCAN_RETRIES; attempt += 1) {
        setRetrying(true)
        await response.body?.cancel()
        await waitForScanRetry(response, controller.signal)
        response = await fetch(url, { signal: controller.signal })
      }
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Analysis is temporarily unavailable.')
      if (!body.history || !body.score || body.address !== normalized) throw new Error('Base activity data was unavailable. Please retry.')
      if (!controller.signal.aborted) {
        lastVerified.current = keepVerifiedEstimate(body, previous)
        setResult(body)
        setVerified(lastVerified.current)
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof SyntaxError ? 'Analysis is temporarily unavailable. Please retry.' : err.message)
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRetrying(false)
      }
    }
  }, [])

  useEffect(() => {
    setAddress(linkedAddress)
    if (linkedAddress) void scanAddress(linkedAddress)
    else {
      setResult(null)
      setVerified(null)
      setLoading(false)
      setRetrying(false)
      setError('')
    }
    return () => request.current?.abort()
  }, [linkedAddress, scanAddress])

  useEffect(() => {
    if (!params.has('date')) return
    const query = new URLSearchParams(params)
    query.delete('date')
    setParams(query, { replace: true })
  }, [params, setParams])

  function handleSubmit(event) {
    event.preventDefault()
    const normalized = address.trim().toLowerCase()
    if (!ADDRESS.test(normalized) || /^0x0{40}$/i.test(normalized)) {
      setError('Enter a valid, non-zero Base wallet address.')
      return
    }
    setParams({ address: normalized }, { replace: true })
    if (normalized === linkedAddress) void scanAddress(normalized)
  }

  const showCount = (value) => value > 0 || result.coverage.activityComplete ? whole(value) : '—'

  return (
    <main className="bac">
      <EmbedMeta title="Base Airdrop Simulator · BaseHub" description="Compare a Base wallet with historical airdrop criteria and calculate a hypothetical allocation." buttonText="Analyze Base wallet" />
      <BackButton />
      <AirdropHubNav />
      <header className="bac-hero">
        <p className="bac-kicker"><span /> Base mainnet</p>
        <h1>Base Airdrop Simulator</h1>
        <p>Enter a Base address to see its activity score, historical airdrop rule matches, and a hypothetical BASE allocation.</p>
        <form className="bac-form" onSubmit={handleSubmit}>
          <label className="bac-address">Base wallet address<input placeholder="0x…" value={address} onChange={(event) => setAddress(event.target.value)} required maxLength={60} spellCheck={false} autoCapitalize="none" autoComplete="off" /></label>
          <button type="submit" disabled={loading}><Search size={17} />{loading ? 'Scanning…' : 'Analyze address'}</button>
        </form>
        {retrying && <p className="bac-footnote" role="status">The scanner is handling other requests. Retrying automatically…</p>}
        {error && <p className="bac-error" role="alert">{error}</p>}
        <p className="bac-footnote">Unofficial simulation · No wallet connection required</p>
      </header>
      {(loading || result || verified) && <Allocation result={result} verified={verified} loading={loading} />}
      {result ? (
        <>
          <div className="bac-result" aria-live="polite">
            <a className="bac-link" href={`https://basescan.org/address/${result.address}`} target="_blank" rel="noreferrer" title={result.address}>{short(result.address)} <ExternalLink size={13} /></a>
            <span>Block {whole(result.block)} · {dateLabel(result.asOf)} UTC</span>
            <span className={`bac-coverage-tag ${result.coverage.activityComplete ? 'bac-met' : 'bac-unknown'}`}>{result.coverage.activityComplete ? 'History verified' : result.coverage.historyUnavailable ? 'History unavailable' : 'Partial history'}</span>
          </div>
          {result.coverage.historyUnavailable ? (
            <div className="bac-data-notice" role="status">
              <strong>Wallet history could not be verified</strong>
              <p>{result.coverage.accountNonce > 0 ? `Base RPC reports an account nonce of ${whole(result.coverage.accountNonce)}. The history provider did not supply enough verified records to score this address.` : 'The history or receipt provider could not complete this scan.'}</p>
              <button type="button" onClick={() => scanAddress(result.address)}>Retry scan</button>
            </div>
          ) : !result.coverage.estimateReady ? (
            <div className="bac-data-notice" role="status">
              <p>The data provider could not verify every record required for the estimate.</p>
              <button type="button" onClick={() => scanAddress(result.address)}>Retry scan</button>
            </div>
          ) : !result.coverage.activityComplete && (
            <p className="bac-data-notice">The verified sample includes {whole(result.coverage.receiptCount)} of {whole(result.coverage.candidateCount)} indexed records. It reflects the scanner’s coverage limits.</p>
          )}
          <dl className="bac-overview">
            <div><dt>Verified actions</dt><dd>{showCount(result.metrics.transactions)}</dd></div>
            <div><dt>Active months</dt><dd>{showCount(result.metrics.months)}</dd></div>
            <div><dt>Contract destinations</dt><dd>{showCount(result.metrics.contracts)}</dd></div>
            <div><dt>x402 payments</dt><dd>{showCount(result.metrics.x402)}</dd></div>
            <div><dt>RWA actions</dt><dd>{showCount(result.metrics.rwaActions)}</dd></div>
            <div><dt>B20 assets used</dt><dd>{showCount(result.metrics.b20Assets)}</dd></div>
          </dl>
          <div className="bac-grid"><ActivityChart result={result} /><Score result={result} /></div>
          <div className="bac-grid bac-secondary"><HistoricalRules rules={result.history} /><Evidence result={result} /></div>
          <section className="bac-panel bac-coverage">
            <h2>Data coverage</h2>
            <p>Scans up to {result.coverage.scanLimit} indexed transactions. Smart-account actions without indexed transfers and untracked protocol activity can be missed. Historical volume is limited to observed USDC flows from supported swaps. The checker uses no private eligibility lists.</p>
            <dl className="bac-stats">
              <div><dt>First observed action</dt><dd>{dateLabel(result.metrics.firstActivity)}</dd></div>
              <div><dt>Last observed action</dt><dd>{dateLabel(result.metrics.lastActivity)}</dd></div>
              <div><dt>Observed USDC swap notional</dt><dd>{result.metrics.usdcVolume || result.coverage.activityComplete ? `${decimal(result.metrics.usdcVolume)} USDC` : '—'}</dd></div>
              <div><dt>Account</dt><dd>{result.coverage.accountType}</dd></div>
              <div><dt>Outgoing history</dt><dd>{result.coverage.external}</dd></div>
              <div><dt>Token sends</dt><dd>{result.coverage.sent}</dd></div>
              <div><dt>Token receipts</dt><dd>{result.coverage.received}</dd></div>
              <div><dt>Stock registry</dt><dd>{result.coverage.stockRegistry}</dd></div>
              <div><dt>B20 checks</dt><dd>{result.coverage.b20Registry}</dd></div>
              <div><dt>Tracked USDC merchants</dt><dd>{result.coverage.x402MerchantHistory}</dd></div>
            </dl>
          </section>
        </>
      ) : null}
      <footer className="bac-sources">
        <a className="bac-link" href={SOURCES.base} target="_blank" rel="noreferrer">Base token statement <ExternalLink size={13} /></a>
        <a className="bac-link" href={SOURCES.stocks} target="_blank" rel="noreferrer">Stock registry <ExternalLink size={13} /></a>
        <a className="bac-link" href={SOURCES.spiko} target="_blank" rel="noreferrer">RWA registry <ExternalLink size={13} /></a>
        <a className="bac-link" href={SOURCES.x402} target="_blank" rel="noreferrer">x402 spec <ExternalLink size={13} /></a>
      </footer>
    </main>
  )
}
