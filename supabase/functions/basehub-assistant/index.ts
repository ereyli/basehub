// Supabase Edge Function: basehub-assistant
// Secure wrapper around OpenAI gpt-4o-mini for the BaseHub in-app assistant.
// Reads user stats and features, calls OpenAI server-side, and returns JSON missions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0'

const MAX_MESSAGE_CHARS = 600
const MAX_HISTORY_LIMIT = 20
const MAX_MISSIONS = 3
const RATE_LIMIT_PER_MINUTE = 10

const allowedOrigins = (Deno.env.get('ASSISTANT_ALLOWED_ORIGINS') ??
  'https://basehub.fun,https://www.basehub.fun,http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return allowedOrigins.includes(origin)
}

function corsHeadersFor(origin: string | null) {
  const allowOrigin = isAllowedOrigin(origin) ? origin! : allowedOrigins[0] ?? 'https://basehub.fun'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const addr = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(addr)) return null
  return addr
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

type Feature = {
  id: string
  title: string
  xpReward: string | null
}

type UserStats = {
  totalXp: number
  totalVolumeUsd: number
  gamesPlayed: number
}

// Static summary of key BaseHub features for the assistant.
// This avoids depending on any database table and guarantees the model
// always knows what exists.
const FEATURES: Feature[] = [
  { id: 'swap', title: 'SwapHub', xpReward: '5k XP / $100' },
  { id: 'wallet-analysis', title: 'Wallet Analysis', xpReward: '400 XP' },
  { id: 'prediction-arena', title: 'Prediction Arena', xpReward: '2000 XP' },
  { id: 'coin-flip', title: 'Coin Flip Game', xpReward: '150 XP' },
  { id: 'dice-roll', title: 'Dice Roll Game', xpReward: '150 XP' },
  { id: 'slots', title: 'Slots Game', xpReward: '150 XP' },
  { id: 'lucky-number', title: 'Lucky Number Game', xpReward: '150 XP' },
  { id: 'gm-game', title: 'GM Game', xpReward: '150 XP' },
  { id: 'gn-game', title: 'GN Game', xpReward: '150 XP' },
  { id: 'token-deployer', title: 'Token Deployer', xpReward: '400 XP' },
  { id: 'ai-nft-launchpad', title: 'AI NFT Launchpad', xpReward: '400 XP' },
  { id: 'x402-payment', title: 'x402 Payment', xpReward: '400 XP' },
]

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = corsHeadersFor(origin)

  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const url = new URL(req.url)
    const { searchParams } = url
    const debug = searchParams.get('debug') === '1'

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) {
      return new Response(JSON.stringify({ error: 'missing_auth_token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: 'invalid_auth_token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    const userId = user.id

    const rawBody = await req.json().catch(() => ({}))
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return new Response(JSON.stringify({ error: 'invalid_json_body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    const body = rawBody as Record<string, unknown>
    const action = body.action === 'history' ? 'history' : 'chat'
    const requestedWallet = normalizeAddress(body.walletAddress)
    const requestLimit = Number(body.limit ?? MAX_HISTORY_LIMIT)
    const historyLimit = Number.isFinite(requestLimit)
      ? Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.trunc(requestLimit)))
      : MAX_HISTORY_LIMIT
    const lastUserMessage = safeString(body.lastUserMessage, MAX_MESSAGE_CHARS)

    // Wallet binding: user_id -> wallet_address server-side mapping.
    let walletLower: string | null = null
    const { data: mapped, error: mappedErr } = await supabaseClient
      .from('assistant_user_wallets')
      .select('wallet_address')
      .eq('user_id', userId)
      .maybeSingle()
    if (mappedErr) {
      return new Response(JSON.stringify({ error: 'wallet_mapping_query_failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    walletLower = normalizeAddress(mapped?.wallet_address ?? null)

    // Optional fallback mapping from profiles table (if project stores auth-user profile there).
    if (!walletLower) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('wallet_address')
        .eq('id', userId)
        .maybeSingle()
      walletLower = normalizeAddress(profile?.wallet_address ?? null)
    }

    if (!walletLower) {
      return new Response(JSON.stringify({ error: 'wallet_mapping_not_found' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    if (requestedWallet && requestedWallet !== walletLower) {
      return new Response(JSON.stringify({ error: 'wallet_binding_mismatch' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Rate limit: IP + wallet (10 req/min)
    const forwarded = req.headers.get('x-forwarded-for') ?? ''
    const cfIp = req.headers.get('cf-connecting-ip') ?? ''
    const rawIp = (forwarded.split(',')[0] || cfIp || 'unknown').trim()
    const ipHash = await sha256Hex(rawIp || 'unknown')
    const oneMinuteAgoIso = new Date(Date.now() - 60_000).toISOString()
    const { count: recentCount } = await supabaseClient
      .from('assistant_request_logs')
      .select('id', { count: 'exact', head: true })
      .eq('wallet_address', walletLower)
      .eq('ip_hash', ipHash)
      .gte('created_at', oneMinuteAgoIso)

    if ((recentCount ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    await supabaseClient.from('assistant_request_logs').insert({
      user_id: userId,
      wallet_address: walletLower,
      ip_hash: ipHash,
    })

    // Use static FEATURES definition above (no DB dependency for feature list).
    const features: Feature[] = FEATURES

    let userStats: UserStats | null = null

    if (walletLower) {
      const { data: player } = await supabaseClient
        .from('players')
        .select('total_xp, level, total_transactions')
        .eq('wallet_address', walletLower)
        .single()

      const { data: txRows } = await supabaseClient
        .from('transactions')
        .select('game_type, swap_amount_usd')
        .eq('wallet_address', walletLower)

      let stats: UserStats = {
        totalXp: player?.total_xp ?? 0,
        totalVolumeUsd: 0,
        gamesPlayed: 0,
      }

      if (txRows && txRows.length > 0) {
        const gameTypes = txRows.map((tx: any) => tx.game_type)
        stats = {
          ...stats,
          gamesPlayed: gameTypes.filter((t: string) =>
            ['GM_GAME', 'GN_GAME', 'FLIP_GAME', 'DICE_ROLL', 'LUCKY_NUMBER', 'SLOT_GAME'].includes(t),
          ).length,
          totalVolumeUsd: txRows
            .filter((tx: any) => tx.swap_amount_usd)
            .reduce(
              (sum: number, tx: any) => sum + (parseFloat(tx.swap_amount_usd as string) || 0),
              0,
            ),
        }
      }

      userStats = stats
    }

    // History-only endpoint (no OpenAI call, low cost).
    if (action === 'history') {
      const { data: historyRows, error } = await supabaseClient
        .from('assistant_messages')
        .select('role, content, created_at')
        .eq('wallet_address', walletLower)
        .order('created_at', { ascending: true })
        .limit(historyLimit)

      if (error) {
        console.error('assistant history error', error)
        return new Response(JSON.stringify({ history: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      return new Response(JSON.stringify({ history: historyRows ?? [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const promptForModel = lastUserMessage ?? 'Help me earn XP inside BaseHub today.'

    // Only persist real user messages (no fallback, no empty)
    if (walletLower && lastUserMessage) {
      await supabaseClient.from('assistant_messages').insert({
        user_id: userId,
        wallet_address: walletLower,
        role: 'user',
        content: lastUserMessage,
      })
    }

    // Load last 20 messages as compact history summary
    let historySummary = ''
    if (walletLower) {
      const { data: historyRows } = await supabaseClient
        .from('assistant_messages')
        .select('role, content')
        .eq('wallet_address', walletLower)
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORY_LIMIT)

      if (historyRows && historyRows.length > 0) {
        historySummary = historyRows
          .reverse()
          .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n')
      }
    }

    const systemPrompt = `
You are the official BaseHub (basehub.fun) assistant. Your focus is BaseHub and the Base ecosystem; stay on topic, but you are not restricted to a fixed list—you know the whole site: tools, games, SwapHub, NFT mint, quests, XP, token/NFT roadmap, onchain activity, etc.

Reference (tools/games and XP):
${JSON.stringify(
  features.map((f) => ({
    id: f.id,
    xpReward: f.xpReward,
  })),
)}

USER_STATS (may be null): ${JSON.stringify(userStats && { totalXp: userStats.totalXp, totalVolumeUsd: userStats.totalVolumeUsd, gamesPlayed: userStats.gamesPlayed })}

RECENT_CONVERSATION (may be empty):
${historySummary}

Your job:
- Answer questions about BaseHub broadly: how things work, strategy, XP, NFT mint, token future, quests, any feature. No artificial limit—use your knowledge of the site.
- When suggesting actions, give 1–3 concrete missions with featureId from the list above when it fits; if the user asks something that doesn’t need missions, you can return an empty missions array and put the answer in message.
- Do not make financial promises; keep tone friendly and short.

Language: Reply in the same language as the user (e.g. Turkish or English).

Output JSON only:
{
  "message": "your answer or summary",
  "missions": [
    { "title": "...", "description": "...", "featureId": "swap", "estimatedXp": "5k XP / $100" }
  ]
}
`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptForModel },
        ],
        temperature: 0.5,
        max_tokens: 280,
      }),
    })

    if (!openaiRes.ok) {
      const text = await openaiRes.text()
      console.error('OpenAI error', openaiRes.status, text)
      return new Response(JSON.stringify({ error: 'openai_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const data = await openaiRes.json()
    const content = data.choices?.[0]?.message?.content || ''
    const jsonStr = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '')
    let payload: any = null
    try {
      payload = JSON.parse(jsonStr)
    } catch (e) {
      console.warn('assistant parse error', e, content)
      payload = null
    }

    // Strict response schema guard.
    const normalizedMessage = safeString(payload?.message, 1200)
    const normalizedMissions = Array.isArray(payload?.missions)
      ? payload.missions
          .slice(0, MAX_MISSIONS)
          .map((m: any) => ({
            title: safeString(m?.title, 120),
            description: safeString(m?.description, 260),
            featureId: safeString(m?.featureId, 60),
            estimatedXp: safeString(m?.estimatedXp, 60),
          }))
          .filter((m: any) => m.title && m.description && m.featureId)
      : []
    if (normalizedMessage) {
      payload = { message: normalizedMessage, missions: normalizedMissions }
    }

    // Fallback: if model did not return proper missions, synthesize a useful but varied answer.
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.missions) || payload.missions.length === 0) {
      const presets = [
        {
          message:
            'Bugün SwapHub hacmi + Wallet Analysis + bir adet hızlı oyun ile hem XP hem de gelecekteki BaseHub token/NFT için sağlam bir adım atabilirsin.',
          missions: [
            {
              title: 'SwapHub ile hacim artır',
              description:
                'Tek seferde 20–30$ civarı bir swap yaparak hem XP kazan hem de ilerideki airdrop ve BaseHub token/NFT için onchain aktiviteni güçlendir.',
              featureId: 'swap',
              estimatedXp: '5k XP / $100',
            },
            {
              title: 'Wallet Analysis çalıştır',
              description:
                'Cüzdanını analiz edip 400 XP kap; BaseHub seni daha iyi tanısın ve ilerideki görevlerde daha akıllı öneriler al.',
              featureId: 'wallet-analysis',
              estimatedXp: '400 XP',
            },
            {
              title: 'Bir oyun oyna',
              description:
                'Coin Flip veya Dice Roll ile 1–2 hızlı oyun oynayıp küçük ama hızlı XP ekle; günlük quest ilerlemeni de hareketlendir.',
              featureId: 'coin-flip',
              estimatedXp: '150 XP',
            },
          ],
        },
        {
          message:
            'Eğer yüksek XP istiyorsan Prediction Arena + SwapHub kombosu, üzerine bir token/NFT aracı eklemek bugün için çok iyi çalışır.',
          missions: [
            {
              title: 'Prediction Arena turu aç',
              description:
                'Bir ETH tahmin turu oluştur ya da mevcut tura katıl; tek hamlede yüksek XP ve onchain aktivite eklersin.',
              featureId: 'prediction-arena',
              estimatedXp: '2000 XP',
            },
            {
              title: 'Orta hacimli bir Swap yap',
              description:
                '15–25$ arası bir swap ile toplam hacmini büyüt; XP ve ilerideki hacim bazlı ödüller için iyi bir adım.',
              featureId: 'swap',
              estimatedXp: '5k XP / $100',
            },
            {
              title: 'Token Deployer dene',
              description:
                'Basit bir test token deploy edip hem aracı tanı hem de ekstra XP kazan; ileride gerçek token/NFT için hazırlık olur.',
              featureId: 'token-deployer',
              estimatedXp: '400 XP',
            },
          ],
        },
        {
          message:
            'Daha ucuz ve eğlenceli bir gün istiyorsan oyunlar + AI NFT Launchpad ile hem XP hem de BaseHub NFT ekosistemine adım atabilirsin.',
          missions: [
            {
              title: '3 farklı oyun oyna',
              description:
                'Coin Flip, Dice Roll ve Slots oyunlarından en az birer kez oyna; küçük ama hızlı XP’ler toplayıp questlerini ilerlet.',
              featureId: 'coin-flip',
              estimatedXp: '3 × 150 XP',
            },
            {
              title: 'AI NFT Launchpad ile NFT üret',
              description:
                'AI NFT Launchpad üzerinden bir NFT mint ederek hem XP kazan hem de BaseHub NFT tarafında erken hareket edenlerden ol.',
              featureId: 'ai-nft-launchpad',
              estimatedXp: '400 XP',
            },
            {
              title: 'x402 Payment dene',
              description:
                'Küçük tutarlı bir x402 ödemesi yap; hem aracı tanırsın hem de farklı bir onchain etkileşim eklemiş olursun.',
              featureId: 'x402-payment',
              estimatedXp: '400 XP',
            },
          ],
        },
      ]

      const chosen = presets[Math.floor(Math.random() * presets.length)]
      payload = chosen
    }

    // Insert assistant message into assistant_messages
    if (walletLower && payload && typeof payload.message === 'string') {
      await supabaseClient.from('assistant_messages').insert({
        user_id: userId,
        wallet_address: walletLower,
        role: 'assistant',
        content: payload.message,
      })
    }

    if (debug) {
      console.log('assistant debug payload', payload)
    }

    return new Response(JSON.stringify(payload ?? {}), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    console.error('basehub-assistant error', e)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

