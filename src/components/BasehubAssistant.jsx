import React, { useMemo, useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Send } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useQuestSystem } from '../hooks/useQuestSystem'
import { useSupabase } from '../hooks/useSupabase'
import { getProductsForHome } from '../config/products'
import { callBasehubAssistant, fetchBasehubAssistantHistory } from '../utils/basehubAssistantClient'

/**
 * BaseHub XP assistant (local-only).
 * Uses only BaseHub config & quest data, no external suggestions.
 */

const BasehubAssistant = ({ lastUserMessage = '' }) => {
  const { address, isConnected } = useAccount()
  const { questProgress } = useQuestSystem()
  const { supabase } = useSupabase()
  const products = useMemo(() => getProductsForHome(), [])
  const [messages, setMessages] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [input, setInput] = useState('')
  const [userStats, setUserStats] = useState(null)
  const [historyLoadedFor, setHistoryLoadedFor] = useState(null)

  const detectedLang = useMemo(() => {
    const text = (lastUserMessage || '').toLowerCase()
    if (!text) return 'tr'
    const turkishHints = ['xp', 'görev', 'gorev', 'kazan', 'arkadaş', 'kanka', 'neden', 'nasıl', 'swap', 'oyun']
    const hasTr = turkishHints.some(w => text.includes(w))
    return hasTr ? 'tr' : 'en'
  }, [lastUserMessage])

  const lang = detectedLang === 'tr' ? 'tr' : 'en'

  const copy = {
    title: 'BaseHub Assistant',
    subtitle: isConnected
      ? 'Let’s plan the fastest XP route for your wallet.'
      : 'Connect your wallet so I can personalize XP suggestions.',
    questHint: questProgress
      ? 'Your daily quest system is active – these missions help you complete it faster.'
      : 'There is also a daily quest system; don’t forget to claim XP from it.',
  }

  // Load basic user stats (XP, volume, games) once
  useEffect(() => {
    const loadStats = async () => {
      if (!isConnected || !address || !supabase) return
      try {
        const wallet = address.toLowerCase()
        const { data: player } = await supabase
          .from('players')
          .select('total_xp, level, total_transactions')
          .eq('wallet_address', wallet)
          .single()

        const { data: allTransactions } = await supabase
          .from('transactions')
          .select('game_type, swap_amount_usd')
          .or(`wallet_address.eq.${wallet},wallet_address.eq.${address}`)

        let stats = {
          totalXp: player?.total_xp || 0,
          level: player?.level || 1,
          totalTx: player?.total_transactions || 0,
          totalVolumeUsd: 0,
          gamesPlayed: 0,
          swapsCompleted: 0,
        }
        if (allTransactions && allTransactions.length > 0) {
          const gameTypes = allTransactions.map((tx) => tx.game_type)
          stats = {
            ...stats,
            gamesPlayed: gameTypes.filter((t) =>
              ['GM_GAME', 'GN_GAME', 'FLIP_GAME', 'DICE_ROLL', 'LUCKY_NUMBER', 'SLOT_GAME'].includes(t),
            ).length,
            swapsCompleted: gameTypes.filter((t) => t === 'SWAP' || t === 'SWAP_VOLUME').length,
            totalVolumeUsd: allTransactions
              .filter((tx) => tx.swap_amount_usd)
              .reduce((sum, tx) => sum + (parseFloat(tx.swap_amount_usd) || 0), 0),
          }
        }

        const questStats = questProgress?.quest_stats || {}

        setUserStats({
          ...stats,
          questStats,
        })
      } catch (e) {
        console.warn('Assistant stats load failed:', e)
      }
    }
    loadStats()
  }, [isConnected, address, supabase, questProgress])

  // Load last chat history from Supabase so it persists across refresh.
  useEffect(() => {
    const loadHistory = async () => {
      if (!isConnected || !address) return
      const wallet = address.toLowerCase()
      if (historyLoadedFor === wallet) return

      try {
        const history = await fetchBasehubAssistantHistory({ walletAddress: address, limit: 20 })
        if (Array.isArray(history) && history.length > 0) {
          setMessages(
            history.map((row) => ({
              role: row.role,
              text: row.content,
            })),
          )
        }
      } catch (e) {
        console.warn('Assistant history load failed:', e)
      } finally {
        setHistoryLoadedFor(wallet)
      }
    }

    loadHistory()
  }, [isConnected, address, historyLoadedFor])

  // NOTE: We intentionally do NOT auto-call the assistant on first open.
  // The user must either click a quick question or type a message.

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 12,
        background: 'radial-gradient(circle at top left, rgba(56,189,248,0.17), rgba(15,23,42,0.96))',
        border: '1px solid rgba(56,189,248,0.35)',
        maxHeight: '100%',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: 'rgba(56,189,248,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(56,189,248,0.5)',
          }}
        >
          <Sparkles size={18} color="#e5f9ff" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e5f9ff' }}>{copy.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.8)' }}>{copy.subtitle}</div>
        </div>
      </div>

      {isConnected && (
        <>
          <div
            style={{
              marginTop: 6,
              marginBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 260,
              overflowY: 'auto',
              paddingRight: 2,
            }}
          >
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant'
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                    maxWidth: '88%',
                  }}
                >
                  <div
                    style={{
                      padding: '7px 9px',
                      borderRadius: 12,
                      fontSize: 11,
                      lineHeight: 1.4,
                      color: isAssistant ? '#e5e7eb' : '#0f172a',
                      background: isAssistant
                        ? 'rgba(15,23,42,0.95)'
                        : 'linear-gradient(135deg,#38bdf8,#22c55e)',
                      border: isAssistant ? '1px solid rgba(148,163,184,0.6)' : 'none',
                    }}
                  >
                    {m.text}
                  </div>
                  {Array.isArray(m.missions) && m.missions.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {m.missions.map((ms, j) => {
                        const feature = ms.featureId ? products.find(p => p.id === ms.featureId) : null
                        const link = feature?.path || ms.link || '#'
                        return (
                          <a
                            key={j}
                            href={link}
                            style={{
                              textDecoration: 'none',
                              borderRadius: 10,
                              padding: '6px 8px',
                              background: 'rgba(15,23,42,0.9)',
                              border: '1px solid rgba(55,65,81,0.9)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: '#e5e7eb',
                                }}
                              >
                                {ms.title}
                              </div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>{ms.description}</div>
                            </div>
                            {ms.estimatedXp && (
                              <div
                                style={{
                                  fontSize: 10,
                                  padding: '3px 7px',
                                  borderRadius: 999,
                                  background: 'rgba(16,185,129,0.2)',
                                  border: '1px solid rgba(16,185,129,0.45)',
                                  color: '#6ee7b7',
                                  fontWeight: 600,
                                  marginLeft: 6,
                                }}
                              >
                                {ms.estimatedXp}
                              </div>
                            )}
                            <ArrowRight size={13} color="#9ca3af" />
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {aiLoading && (
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {'Assistant is thinking...'}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 4,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {!aiLoading && (
              <>
                {[
                  'How do I earn XP the fastest today?',
                  'Which feature gives the cheapest XP?',
                  'What should I do today for BaseHub NFT and token?',
                ].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={async () => {
                      if (aiLoading) return
                      const userText = q
                      setMessages((prev) => [...prev, { role: 'user', text: userText }])
                      setAiLoading(true)
                      const res = await callBasehubAssistant({
                        language: lang,
                        products,
                        lastUserMessage: userText,
                        userStats,
                        walletAddress: address,
                      })
                      setAiLoading(false)
                      if (res && typeof res === 'object') {
                        const reply =
                          res.message || 'Here is how I suggest doing this inside BaseHub.'
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: 'assistant',
                            text: reply,
                            missions: Array.isArray(res.missions) ? res.missions : null,
                          },
                        ])
                      }
                    }}
                    style={{
                      borderRadius: 999,
                      border: '1px solid rgba(148,163,184,0.7)',
                      padding: '4px 8px',
                      fontSize: 10,
                      background: 'rgba(15,23,42,0.95)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (aiLoading) return
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: 'assistant',
                        text: 'Try these three steps today to progress on NFTs.',
                        missions: [
                          {
                            title: 'Mint an NFT on AI NFT Launchpad',
                            description:
                              'Pick a simple image or concept and mint your first NFT on AI NFT Launchpad for 400 XP and to join the BaseHub NFT ecosystem.',
                            featureId: 'ai-nft-launchpad',
                            estimatedXp: '400 XP',
                          },
                          {
                            title: 'Do a small swap',
                            description:
                              'Do a $5–15 swap to boost onchain activity and volume for future airdrops and BaseHub token/NFT plans.',
                            featureId: 'swap',
                            estimatedXp: '5k XP / $100',
                          },
                          {
                            title: 'Trigger a quest with a game',
                            description:
                              'Play 1–2 rounds of Coin Flip or Dice Roll to move daily quest game goals and earn extra XP.',
                            featureId: 'coin-flip',
                            estimatedXp: '150 XP',
                          },
                        ],
                      },
                    ])
                  }}
                  style={{
                    borderRadius: 999,
                    border: '1px solid rgba(251,191,36,0.8)',
                    padding: '4px 8px',
                    fontSize: 10,
                    background: 'linear-gradient(135deg,#fbbf24,#f97316)',
                    color: '#111827',
                    cursor: 'pointer',
                  }}
                >
                  Get NFT-focused suggestions
                </button>
              </>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                'Tell me what you want to do on BaseHub (any language).'
              }
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!input.trim() || aiLoading) return
                  const userText = input.trim()
                  setInput('')
                  setMessages((prev) => [...prev, { role: 'user', text: userText }])
                  setAiLoading(true)
                  const res = await callBasehubAssistant({
                    language: lang,
                    products,
                    lastUserMessage: userText,
                    userStats,
                    walletAddress: address,
                  })
                  setAiLoading(false)
                  if (res && typeof res === 'object') {
                    const reply = res.message || 'Here is how I suggest doing this inside BaseHub.'
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: 'assistant',
                        text: reply,
                        missions: Array.isArray(res.missions) ? res.missions : null,
                      },
                    ])
                  }
                }
              }}
              style={{
                flex: 1,
                fontSize: 11,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.7)',
                padding: '7px 10px',
                background: 'rgba(15,23,42,0.96)',
                color: '#e5e7eb',
                outline: 'none',
              }}
            />
            <button
              type="button"
              disabled={!input.trim() || aiLoading}
              onClick={async () => {
                if (!input.trim() || aiLoading) return
                const userText = input.trim()
                setInput('')
                setMessages((prev) => [...prev, { role: 'user', text: userText }])
                setAiLoading(true)
                const res = await callBasehubAssistant({
                  language: lang,
                  products,
                  lastUserMessage: userText,
                  userStats,
                  walletAddress: address,
                })
                setAiLoading(false)
                if (res && typeof res === 'object') {
                  const reply = res.message || 'Here is how I suggest doing this inside BaseHub.'
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: 'assistant',
                      text: reply,
                      missions: Array.isArray(res.missions) ? res.missions : null,
                    },
                  ])
                }
              }}
              style={{
                border: 'none',
                borderRadius: 999,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: aiLoading || !input.trim() ? 'default' : 'pointer',
                background: aiLoading || !input.trim()
                  ? 'rgba(30,64,175,0.4)'
                  : 'linear-gradient(135deg,#3b82f6,#22c55e)',
                color: '#e5e7eb',
              }}
            >
              <Send size={15} />
            </button>
          </div>

          <div
            style={{
              marginTop: 8,
              paddingTop: 6,
              borderTop: '1px dashed rgba(148,163,184,0.6)',
              fontSize: 11,
              color: 'rgba(148,163,184,0.95)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Sparkles size={12} color="#e5e7eb" />
            <span>{copy.questHint}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default BasehubAssistant

