import React, { useMemo } from 'react'
import { Sparkles, Zap, Target, ArrowRight } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useQuestSystem } from '../hooks/useQuestSystem'
import { getProductsForHome } from '../config/products'

/**
 * BaseHub AI-style assistant (rule-based MVP).
 *
 * IMPORTANT GUARANTEES (design-level, not model-level, since this is deterministic):
 * - Only talks about BaseHub features (pulled from PRODUCTS config).
 * - Only suggests actions that exist inside BaseHub (links to internal routes).
 * - XP amounts are taken from config strings, not hallucinated.
 * - Language: replies in the same language as the last user message (simple heuristic).
 *
 * This component does NOT call an external LLM yet; it is a safe MVP that behaves
 * like an assistant without risk of hallucinating unsupported features.
 */

const BasehubAssistant = ({ lastUserMessage = '' }) => {
  const { address, isConnected } = useAccount()
  const { questProgress } = useQuestSystem()

  const products = useMemo(() => getProductsForHome(), [])

  const detectedLang = useMemo(() => {
    const text = (lastUserMessage || '').toLowerCase()
    if (!text) return 'tr' // default to Turkish for you
    const turkishHints = ['xp', 'görev', 'gorev', 'kazan', 'arkadaş', 'kanka', 'neden', 'nasıl', 'yapmalıyım', 'swap', 'oyun']
    const hasTr = turkishHints.some(w => text.includes(w))
    return hasTr ? 'tr' : 'en'
  }, [lastUserMessage])

  const quickWins = useMemo(() => {
    const byId = {}
    products.forEach(p => { byId[p.id] = p })
    const wins = []

    if (byId['swap']) {
      wins.push({
        id: 'swap-quick',
        link: byId['swap'].path,
        xp: byId['swap'].xpReward,
        title: 'SwapHub',
        descriptionTr: 'Bugün küçük bir swap yap (örneğin $10) – hacmin arttıkça XP’e daha hızlı yaklaşırsın.',
        descriptionEn: 'Do a small swap today (e.g. $10) – the more volume you do, the faster you reach XP milestones.',
      })
    }
    if (byId['flip']) {
      wins.push({
        id: 'flip-quick',
        link: byId['flip'].path,
        xp: byId['flip'].xpReward,
        title: 'Coin Flip',
        descriptionTr: 'Tek el Coin Flip oyna – hızlı ve düşük riskli XP.',
        descriptionEn: 'Play one round of Coin Flip – fast and low-friction XP.',
      })
    }
    if (byId['wallet-analysis']) {
      wins.push({
        id: 'wallet-quick',
        link: byId['wallet-analysis'].path,
        xp: byId['wallet-analysis'].xpReward,
        title: 'Wallet Analysis',
        descriptionTr: 'Herhangi bir cüzdanı analiz et – hem eğlen, hem de ekstra XP al.',
        descriptionEn: 'Run a wallet analysis – fun insights plus extra XP.',
      })
    }

    return wins.slice(0, 3)
  }, [products])

  const todayMissions = useMemo(() => {
    const missions = []
    const byId = {}
    products.forEach(p => { byId[p.id] = p })

    if (byId['swap']) {
      missions.push({
        id: 'swap-mission',
        link: byId['swap'].path,
        xp: byId['swap'].xpReward,
        title: 'SwapHub volume push',
        descriptionTr: 'SwapHub’da en az $25’lik bir swap yap. Hacim XP milestone’larına doğru ilerlersin.',
        descriptionEn: 'Do at least a $25 swap on SwapHub. This pushes you towards volume XP milestones.',
      })
    }
    if (byId['dice']) {
      missions.push({
        id: 'dice-mission',
        link: byId['dice'].path,
        xp: byId['dice'].xpReward,
        title: 'Dice warm-up',
        descriptionTr: '1 kez Dice oyna – hem XP, hem de quest ilerlemesi için güzel bir ısınma.',
        descriptionEn: 'Play Dice once – nice warm-up for both XP and quest progress.',
      })
    }
    if (byId['deploy']) {
      missions.push({
        id: 'deploy-mission',
        link: byId['deploy'].path,
        xp: byId['deploy'].xpReward,
        title: 'First token deploy',
        descriptionTr: 'Eğer daha önce denemediysen, test amaçlı küçük bir ERC20 deploy et. Hem BaseHub’ı, hem de Base’i daha iyi tanırsın.',
        descriptionEn: 'If you never tried it, deploy a small test ERC20. Great way to explore BaseHub and Base.',
      })
    }

    return missions
  }, [products])

  const langText = detectedLang === 'tr'
    ? {
        title: 'BaseHub Asistanı',
        subtitle: isConnected
          ? `Cüzdanın için özel XP rotasını beraber çıkaralım.`
          : `Cüzdanını bağlarsan sana özel XP yolu çizebilirim.`,
        todayMissionsTitle: 'Bugün için görev önerilerim',
        quickWinsTitle: 'Hemen yapabileceğin hızlı XP hareketleri',
        questHint: questProgress
          ? 'Günlük quest sistemin de aktif – buradaki görevler onu da tamamlamana yardım eder.'
          : 'Ayrıca günlük quest sistemi de var; bu görevler ona paralel çalışır.',
        connectLabel: 'Cüzdan bağlı değil',
        connectText: 'Önerileri gerçekten kişisel hale getirmek için önce cüzdanını bağlamalısın.',
      }
    : {
        title: 'BaseHub Assistant',
        subtitle: isConnected
          ? `Let’s plan the fastest XP route for your wallet.`
          : `Connect your wallet so I can personalize XP suggestions for you.`,
        todayMissionsTitle: 'Suggested missions for today',
        quickWinsTitle: 'Fast XP actions you can take now',
        questHint: questProgress
          ? 'Your daily quest system is active – these missions help you complete it faster.'
          : 'There is also a daily quest system; these missions align with it.',
        connectLabel: 'Wallet not connected',
        connectText: 'To personalize suggestions, please connect your wallet first.',
      }

  return (
    <div
      style={{
        marginTop: '24px',
        borderRadius: '20px',
        padding: '18px 18px 20px',
        background: 'radial-gradient(circle at top left, rgba(56,189,248,0.2), rgba(15,23,42,0.95))',
        border: '1px solid rgba(56,189,248,0.35)',
        boxShadow: '0 12px 40px rgba(15,23,42,0.9)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div
          style={{
            width: 32,
            height: 32,
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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e5f9ff' }}>{langText.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.8)' }}>{langText.subtitle}</div>
        </div>
      </div>

      {!isConnected && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(15,23,42,0.85)',
            border: '1px dashed rgba(148,163,184,0.6)',
            fontSize: 12,
            color: 'rgba(148,163,184,0.95)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{langText.connectLabel}</div>
          <div>{langText.connectText}</div>
        </div>
      )}

      {isConnected && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Target size={14} color="#facc15" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#facc15' }}>
                {langText.todayMissionsTitle}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayMissions.map((m) => (
                <a
                  key={m.id}
                  href={m.link}
                  style={{
                    textDecoration: 'none',
                    borderRadius: 12,
                    padding: '10px 12px',
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(55,65,81,0.9)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {detectedLang === 'tr' ? m.descriptionTr : m.descriptionEn}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                      marginLeft: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.4)',
                        color: '#6ee7b7',
                        fontWeight: 600,
                      }}
                    >
                      {m.xp}
                    </div>
                    <ArrowRight size={14} color="#9ca3af" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Zap size={14} color="#38bdf8" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#bae6fd' }}>
                {langText.quickWinsTitle}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quickWins.map((w) => (
                <a
                  key={w.id}
                  href={w.link}
                  style={{
                    textDecoration: 'none',
                    borderRadius: 12,
                    padding: '8px 10px',
                    background: 'rgba(15,23,42,0.92)',
                    border: '1px solid rgba(30,64,175,0.8)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#e5e7eb' }}>{w.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      {detectedLang === 'tr' ? w.descriptionTr : w.descriptionEn}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                      marginLeft: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        padding: '3px 7px',
                        borderRadius: 999,
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.4)',
                        color: '#6ee7b7',
                        fontWeight: 600,
                      }}
                    >
                      {w.xp}
                    </div>
                    <ArrowRight size={13} color="#9ca3af" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 6,
              borderTop: '1px dashed rgba(148,163,184,0.5)',
              fontSize: 11,
              color: 'rgba(148,163,184,0.9)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Sparkles size={12} color="#e5e7eb" />
            <span>{langText.questHint}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default BasehubAssistant

