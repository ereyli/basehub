import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Bot,
  CheckCircle,
  ExternalLink,
  Eye,
  Filter,
  Image as ImageIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import BackButton from '../components/BackButton'
import { NETWORKS, getAddressExplorerUrl, getTransactionExplorerUrl } from '../config/networks'
import { recordERC8004AgentView, useERC8004Agents } from '../hooks/useERC8004Agents'

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'views', label: 'Most viewed' },
  { id: 'x402', label: 'x402 enabled' },
  { id: 'verified', label: 'Verified metadata' },
]

const PAGE_SIZE = 30

function shortAddress(value) {
  if (!value) return ''
  return `${String(value).slice(0, 6)}...${String(value).slice(-4)}`
}

function getServiceLabel(service) {
  const name = String(service?.name || '').trim()
  const endpoint = String(service?.endpoint || '').trim()
  if (name) return name.toUpperCase()
  if (endpoint.includes('mcp')) return 'MCP'
  if (endpoint.includes('agent-card')) return 'A2A'
  return 'WEB'
}

function AgentImage({ agent }) {
  const candidates = useMemo(() => {
    return Array.from(new Set([
      agent?.image,
      ...(Array.isArray(agent?.imageCandidates) ? agent.imageCandidates : []),
    ].filter(Boolean)))
  }, [agent?.image, agent?.imageCandidates])
  const [index, setIndex] = useState(0)
  const src = candidates[index]

  if (!src) return <ImageIcon size={30} color="#8fb6ff" />

  return (
    <img
      src={src}
      alt={agent?.name || 'Agent logo'}
      style={styles.avatarImage}
      loading="lazy"
      onError={() => {
        if (index + 1 < candidates.length) {
          setIndex(index + 1)
        } else {
          setIndex(candidates.length)
        }
      }}
    />
  )
}

function AgentDirectory() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [visibleViews, setVisibleViews] = useState({})
  const { agents, totalRegistered, filteredCount, pageCount, totalX402, totalVerified, categories, isLoading, error, refresh, lastUpdated } = useERC8004Agents({
    limit: PAGE_SIZE,
    page,
    sort: sortBy,
    category,
    query,
  })

  useEffect(() => {
    setPage(1)
  }, [category, query, sortBy])

  const filteredAgents = useMemo(() => {
    let list = agents

    if (sortBy === 'views') {
      list = [...list].sort((a, b) => {
        const aViews = visibleViews[a.agentId] ?? a.views ?? 0
        const bViews = visibleViews[b.agentId] ?? b.views ?? 0
        return bViews - aViews || Number(b.agentId || 0) - Number(a.agentId || 0)
      })
    } else if (sortBy === 'x402') {
      list = [...list].sort((a, b) => Number(Boolean(b.x402Enabled)) - Number(Boolean(a.x402Enabled)))
    } else if (sortBy === 'verified') {
      list = [...list].sort((a, b) => Number(Boolean(b.metadataOk)) - Number(Boolean(a.metadataOk)))
    }

    return list
  }, [agents, sortBy, visibleViews])

  const loadedStart = filteredCount > 0 ? ((page - 1) * PAGE_SIZE) + 1 : 0
  const loadedEnd = Math.min(page * PAGE_SIZE, filteredCount)
  const updatedLabel = lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
  const pageNumbers = useMemo(() => {
    const total = Math.max(1, pageCount)
    const visible = new Set([1, total, page - 1, page, page + 1].filter((item) => item >= 1 && item <= total))
    return Array.from(visible).sort((a, b) => a - b)
  }, [page, pageCount])

  const handleViewAgent = (agent) => {
    const fallbackViews = (visibleViews[agent.agentId] ?? agent.views ?? 0) + 1
    setVisibleViews(prev => ({ ...prev, [agent.agentId]: fallbackViews }))
    recordERC8004AgentView(agent)
      .then((result) => {
        if (result?.viewCount != null) {
          setVisibleViews(prev => ({ ...prev, [agent.agentId]: Number(result.viewCount) }))
        }
      })
      .catch((error) => {
        console.warn('Could not record ERC-8004 agent view:', error)
      })
  }

  return (
    <div className="deploy-token-page" style={{ background: '#07111f', minHeight: '100vh' }}>
      <Helmet>
        <title>AI Agents on Base - BaseHub</title>
        <meta name="description" content="Browse ERC-8004 AI agents registered on Base through BaseHub." />
      </Helmet>

      <div style={styles.shell}>
        <BackButton />

        <style>{`
          @media (max-width: 820px) {
            .agent-directory-hero,
            .agent-directory-toolbar {
              grid-template-columns: 1fr !important;
            }
            .agent-directory-stats {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }
          @media (max-width: 460px) {
            .agent-directory-stats {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        <section className="agent-directory-hero" style={styles.hero}>
          <div style={styles.heroCopy}>
            <div style={styles.badge}>
              <Sparkles size={15} />
              AI AGENTS ON BASE
            </div>
            <h1 style={styles.title}>Agent Directory</h1>
            <p style={styles.subtitle}>
              Browse ERC-8004 agent identities registered through BaseHub. Discover new agents, x402-ready services, verified metadata, and their onchain owners.
            </p>
            <div style={styles.heroActions}>
              <Link to="/deploy-erc8004" style={styles.primaryLink}>
                <Bot size={18} />
                Register Agent
              </Link>
              <button type="button" onClick={() => refresh({ sync: true })} style={styles.secondaryButton} disabled={isLoading}>
                <RefreshCw size={17} />
                {isLoading ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="agent-directory-stats" style={styles.statsGrid}>
            <StatCard label="Registered" value={totalRegistered == null ? '...' : totalRegistered.toLocaleString()} icon={<Users size={18} />} />
            <StatCard label="Showing" value={`${loadedStart}-${loadedEnd}`} icon={<Bot size={18} />} />
            <StatCard label="x402" value={totalX402.toLocaleString()} icon={<Zap size={18} />} />
            <StatCard label="Verified" value={totalVerified.toLocaleString()} icon={<ShieldCheck size={18} />} />
          </div>
        </section>

        <section className="agent-directory-toolbar" style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agent, owner, endpoint, category"
              style={styles.searchInput}
            />
          </div>

          <div style={styles.categoryWrap}>
            <Filter size={16} />
            <select value={category} onChange={(event) => setCategory(event.target.value)} style={styles.select}>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </section>

        <div style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSortBy(option.id)}
              style={{
                ...styles.sortButton,
                ...(sortBy === option.id ? styles.sortButtonActive : null),
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {updatedLabel && !error && (
          <div style={styles.updated}>
            Last updated {updatedLabel} · {filteredCount.toLocaleString()} result{filteredCount === 1 ? '' : 's'} · Page {page.toLocaleString()} of {pageCount.toLocaleString()}
          </div>
        )}

        <section style={styles.grid}>
          {filteredAgents.map((agent) => {
            const views = visibleViews[agent.agentId] ?? agent.views ?? 0
            return (
              <article key={`${agent.agentId}-${agent.txHash}`} style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={styles.avatar}>
                    <AgentImage agent={agent} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.cardTitle}>{agent.name}</div>
                    <div style={styles.agentId}>Agent ID #{agent.agentId}</div>
                  </div>
                </div>

                <p style={styles.description}>{agent.description}</p>

                <div style={styles.pillRow}>
                  <span style={styles.categoryPill}>{agent.category}</span>
                  {agent.x402Enabled && <span style={styles.x402Pill}><Zap size={13} /> x402</span>}
                  <span style={agent.metadataOk ? styles.verifiedPill : styles.unverifiedPill}>
                    {agent.metadataOk ? <CheckCircle size={13} /> : <ShieldCheck size={13} />}
                    {agent.metadataOk ? 'Verified' : 'Metadata pending'}
                  </span>
                </div>

                <div style={styles.serviceRow}>
                  {(agent.services || []).slice(0, 3).map((service, index) => (
                    <span key={`${service?.endpoint || index}`} style={styles.servicePill}>
                      {getServiceLabel(service)}
                    </span>
                  ))}
                  {!agent.services?.length && <span style={styles.servicePillMuted}>No public service</span>}
                </div>

                <div style={styles.metaRows}>
                  <div style={styles.metaRow}>
                    <span>Owner</span>
                    <a href={getAddressExplorerUrl(NETWORKS.BASE.chainId, agent.owner)} target="_blank" rel="noreferrer" style={styles.metaLink}>
                      {shortAddress(agent.owner)}
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div style={styles.metaRow}>
                    <span>Views</span>
                    <span style={styles.viewCount}><Eye size={13} /> {views}</span>
                  </div>
                </div>

                <div style={styles.cardActions}>
                  <a
                    href={agent.agentURI}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.cardButton}
                    onClick={() => handleViewAgent(agent)}
                  >
                    Metadata
                    <ExternalLink size={14} />
                  </a>
                  <a
                    href={getTransactionExplorerUrl(NETWORKS.BASE.chainId, agent.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.cardButtonGhost}
                    onClick={() => handleViewAgent(agent)}
                  >
                    Tx
                    <ExternalLink size={14} />
                  </a>
                </div>
              </article>
            )
          })}
        </section>

        {pageCount > 1 && (
          <nav style={styles.pagination} aria-label="Agent directory pagination">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || isLoading}
              style={{ ...styles.pageButton, ...(page <= 1 ? styles.pageButtonDisabled : null) }}
            >
              Prev
            </button>
            {pageNumbers.map((item, index) => {
              const previous = pageNumbers[index - 1]
              return (
                <React.Fragment key={item}>
                  {previous && item - previous > 1 && <span style={styles.pageGap}>...</span>}
                  <button
                    type="button"
                    onClick={() => setPage(item)}
                    disabled={isLoading}
                    style={{
                      ...styles.pageButton,
                      ...(item === page ? styles.pageButtonActive : null),
                    }}
                  >
                    {item}
                  </button>
                </React.Fragment>
              )
            })}
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              disabled={page >= pageCount || isLoading}
              style={{ ...styles.pageButton, ...(page >= pageCount ? styles.pageButtonDisabled : null) }}
            >
              Next
            </button>
          </nav>
        )}

        {!isLoading && filteredAgents.length === 0 && (
          <div style={styles.empty}>
            No agents found for this filter.
          </div>
        )}

        {isLoading && agents.length === 0 && (
          <div style={styles.loading}>Loading BaseHub agent registry...</div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  )
}

const styles = {
  shell: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '24px 12px 72px',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(300px, 0.85fr)',
    gap: '18px',
    alignItems: 'stretch',
    marginTop: '18px',
  },
  heroCopy: {
    border: '1px solid rgba(96, 165, 250, 0.2)',
    background: 'linear-gradient(180deg, rgba(12, 24, 44, 0.96), rgba(3, 8, 20, 0.94))',
    borderRadius: '8px',
    padding: '28px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#93c5fd',
    border: '1px solid rgba(96, 165, 250, 0.32)',
    background: 'rgba(37, 99, 235, 0.12)',
    borderRadius: '8px',
    padding: '7px 10px',
    fontSize: '12px',
    fontWeight: 900,
    marginBottom: '18px',
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 'clamp(34px, 5vw, 58px)',
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: 0,
  },
  subtitle: {
    color: '#a8b3c7',
    fontSize: '16px',
    lineHeight: 1.65,
    maxWidth: '680px',
    margin: '16px 0 0',
  },
  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '24px',
  },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '9px',
    color: '#05111f',
    background: '#60a5fa',
    borderRadius: '8px',
    padding: '12px 15px',
    fontWeight: 900,
    textDecoration: 'none',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '9px',
    color: '#dbeafe',
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: '8px',
    padding: '12px 15px',
    fontWeight: 850,
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  statCard: {
    minHeight: '128px',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.72)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  statIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    display: 'grid',
    placeItems: 'center',
    color: '#bfdbfe',
    background: 'rgba(96, 165, 250, 0.12)',
  },
  statLabel: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#f8fafc',
    fontSize: '26px',
    lineHeight: 1,
  },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 220px',
    gap: '10px',
    marginTop: '18px',
  },
  searchWrap: {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.74)',
    borderRadius: '8px',
    padding: '0 14px',
    color: '#94a3b8',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 0,
    outline: 0,
    background: 'transparent',
    color: '#f8fafc',
    fontSize: '15px',
  },
  categoryWrap: {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.74)',
    borderRadius: '8px',
    padding: '0 12px',
    color: '#94a3b8',
  },
  select: {
    flex: 1,
    minWidth: 0,
    border: 0,
    outline: 0,
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '14px',
  },
  sortRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
  },
  sortButton: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.62)',
    color: '#94a3b8',
    borderRadius: '8px',
    padding: '9px 12px',
    fontWeight: 850,
    cursor: 'pointer',
  },
  sortButtonActive: {
    color: '#dbeafe',
    borderColor: 'rgba(96, 165, 250, 0.45)',
    background: 'rgba(37, 99, 235, 0.18)',
  },
  updated: {
    color: '#64748b',
    fontSize: '12px',
    marginTop: '10px',
  },
  error: {
    marginTop: '12px',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.28)',
    background: 'rgba(127, 29, 29, 0.2)',
    borderRadius: '8px',
    padding: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
    marginTop: '18px',
  },
  card: {
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(15, 23, 42, 0.78)',
    borderRadius: '8px',
    padding: '14px',
    minWidth: 0,
  },
  cardTop: {
    display: 'grid',
    gridTemplateColumns: '58px minmax(0, 1fr)',
    gap: '12px',
    alignItems: 'center',
  },
  avatar: {
    width: '58px',
    height: '58px',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(96, 165, 250, 0.25)',
    background: 'rgba(30, 41, 59, 0.8)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: '17px',
    fontWeight: 900,
    overflowWrap: 'anywhere',
  },
  agentId: {
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 800,
    marginTop: '4px',
  },
  description: {
    color: '#a8b3c7',
    fontSize: '13px',
    lineHeight: 1.5,
    minHeight: '60px',
    margin: '14px 0',
    overflowWrap: 'anywhere',
  },
  pillRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  categoryPill: {
    color: '#bfdbfe',
    background: 'rgba(59, 130, 246, 0.14)',
    border: '1px solid rgba(96, 165, 250, 0.22)',
    borderRadius: '8px',
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: 900,
  },
  x402Pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#86efac',
    background: 'rgba(34, 197, 94, 0.12)',
    border: '1px solid rgba(34, 197, 94, 0.24)',
    borderRadius: '8px',
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: 900,
  },
  verifiedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#a7f3d0',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.24)',
    borderRadius: '8px',
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: 900,
  },
  unverifiedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#fbbf24',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.24)',
    borderRadius: '8px',
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: 900,
  },
  serviceRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '10px',
    minHeight: '24px',
  },
  servicePill: {
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '8px',
    padding: '4px 7px',
    fontSize: '10px',
    fontWeight: 900,
  },
  servicePillMuted: {
    color: '#64748b',
    fontSize: '12px',
  },
  metaRows: {
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
    marginTop: '12px',
    paddingTop: '10px',
    display: 'grid',
    gap: '8px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 800,
  },
  metaLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    color: '#93c5fd',
    textDecoration: 'none',
  },
  viewCount: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    color: '#cbd5e1',
  },
  cardActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 88px',
    gap: '8px',
    marginTop: '12px',
  },
  cardButton: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '7px',
    background: '#2563eb',
    color: '#eff6ff',
    borderRadius: '8px',
    padding: '10px',
    textDecoration: 'none',
    fontWeight: 900,
    fontSize: '13px',
  },
  cardButtonGhost: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '7px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    color: '#cbd5e1',
    borderRadius: '8px',
    padding: '10px',
    textDecoration: 'none',
    fontWeight: 900,
    fontSize: '13px',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '22px',
  },
  pageButton: {
    minWidth: '40px',
    minHeight: '38px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.78)',
    color: '#cbd5e1',
    borderRadius: '8px',
    padding: '8px 11px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  pageButtonActive: {
    color: '#05111f',
    borderColor: '#60a5fa',
    background: '#60a5fa',
  },
  pageButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  pageGap: {
    color: '#64748b',
    fontWeight: 900,
    padding: '0 2px',
  },
  loading: {
    marginTop: '24px',
    color: '#93c5fd',
    textAlign: 'center',
    fontWeight: 850,
  },
  empty: {
    marginTop: '24px',
    color: '#94a3b8',
    textAlign: 'center',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: '8px',
    padding: '28px',
  },
}

export default AgentDirectory
