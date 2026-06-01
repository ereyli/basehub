// record-swap: SwapHub swap tx'ini on-chain doğrular, swaphub_swaps + swaphub_volume kaydeder, XP verir
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
]

const SWAPHUB_AGGREGATOR_V2 = "0xbf579e68ba69de03ccec14476eb8d765ec558257"
const SWAPHUB_AGGREGATOR_V3_LEGACY = "0xb1b00880fe88fba62ddb4ed329bcb3ff42ca9570"
const SWAPHUB_AGGREGATOR_V3_SAFE_BUGGY = "0x2bc0d802889de33823495d42e9a7e85285f5a047"
const SWAPHUB_AGGREGATOR_V3_SAFE = "0x1bbf38869bd581693aeb8e1cdd0b3c2e6a5fbe5a"
const SWAPHUB_AGGREGATORS = new Set([
  SWAPHUB_AGGREGATOR_V2,
  SWAPHUB_AGGREGATOR_V3_LEGACY,
  SWAPHUB_AGGREGATOR_V3_SAFE_BUGGY,
  SWAPHUB_AGGREGATOR_V3_SAFE,
])
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
const USDBC_ADDRESS = "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca"
const DAI_ADDRESS = "0x50c5725949a6f0c72e6c4a641f24049a917db0cb"
const SWAP_V2_SELECTOR = "0x83b82a53"
const SWAP_V3_SELECTOR = "0x6b9262dc"
const EXECUTE_SWAP_SELECTOR = "0x557e9206"
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
const DEFAULT_ETH_USD = 3500
const MAX_VERIFIED_SWAP_USD = 1000
const SUBMITTED_AMOUNT_TOLERANCE = 0.1
const SUBMITTED_AMOUNT_ABSOLUTE_TOLERANCE = 0.05

type TokenPricing = {
  decimals: number
  usd: number
}

type RpcLog = {
  address?: string
  topics?: string[]
  data?: string
}

type TxReceipt = {
  status: string
  from?: string
  to?: string
  logs?: RpcLog[]
}

type RpcTransaction = {
  from?: string
  to?: string
  input?: string
  value?: string
}

type ParsedSwapCall = {
  selector: string
  tokenIn: string
  tokenOut: string
  amountIn: bigint
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T | null> {
  for (const rpc of BASE_RPC_URLS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
          id: 1,
        }),
      })
      const json = await res.json()
      if (json?.result) return json.result as T
    } catch (_) {
      // try next RPC
    }
  }
  return null
}

async function getTransactionReceipt(txHash: string): Promise<TxReceipt | null> {
  const receipt = await rpcCall<any>("eth_getTransactionReceipt", [txHash])
  if (!receipt) return null
  return {
    status: receipt.status != null ? String(receipt.status) : "",
    from: receipt.from,
    to: receipt.to,
    logs: Array.isArray(receipt.logs) ? receipt.logs : [],
  }
}

async function getTransaction(txHash: string): Promise<RpcTransaction | null> {
  const tx = await rpcCall<any>("eth_getTransactionByHash", [txHash])
  if (!tx) return null
  return {
    from: tx.from,
    to: tx.to,
    input: tx.input,
    value: tx.value,
  }
}

function normalizeAddress(addr: string): string {
  if (!addr || typeof addr !== "string") return ""
  return addr.toLowerCase().trim()
}

function decodeAddressWord(word: string): string {
  const clean = word.replace(/^0x/, "").padStart(64, "0")
  return normalizeAddress(`0x${clean.slice(24)}`)
}

function decodeUintWord(word: string): bigint {
  const clean = word.replace(/^0x/, "") || "0"
  return BigInt(`0x${clean}`)
}

function getCallWord(input: string, wordIndex: number): string {
  const clean = input.replace(/^0x/, "")
  const start = 8 + wordIndex * 64
  return clean.slice(start, start + 64)
}

function parseAggregatorSwapCall(input?: string): ParsedSwapCall | null {
  if (!input || !input.startsWith("0x") || input.length < 10 + 64 * 5) return null

  const selector = input.slice(0, 10).toLowerCase()
  if (selector === SWAP_V2_SELECTOR) {
    return {
      selector,
      tokenIn: decodeAddressWord(getCallWord(input, 0)),
      tokenOut: decodeAddressWord(getCallWord(input, 1)),
      amountIn: decodeUintWord(getCallWord(input, 2)),
    }
  }

  if (selector === SWAP_V3_SELECTOR) {
    return {
      selector,
      tokenIn: decodeAddressWord(getCallWord(input, 0)),
      tokenOut: decodeAddressWord(getCallWord(input, 1)),
      amountIn: decodeUintWord(getCallWord(input, 3)),
    }
  }

  if (selector === EXECUTE_SWAP_SELECTOR) {
    return {
      selector,
      tokenIn: decodeAddressWord(getCallWord(input, 1)),
      tokenOut: decodeAddressWord(getCallWord(input, 2)),
      amountIn: decodeUintWord(getCallWord(input, 3)),
    }
  }

  return null
}

function weiToEthNumber(valueWei: bigint): number {
  return Number(valueWei) / 1e18
}

function tokenAmountToNumber(amount: bigint, decimals: number): number {
  if (amount <= 0n) return 0
  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  return Number(whole) + Number(fraction) / Number(divisor)
}

function getEthUsdPrice(): number {
  const raw = Deno.env.get("SWAPHUB_ETH_USD_FALLBACK") || Deno.env.get("ETH_USD_FALLBACK")
  const parsed = raw ? Number(raw) : DEFAULT_ETH_USD
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ETH_USD
}

function parseTokenPriceOverrides(): Record<string, TokenPricing> {
  const raw = Deno.env.get("SWAPHUB_TOKEN_PRICES_JSON")
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, { decimals?: unknown; usd?: unknown }>
    return Object.entries(parsed).reduce<Record<string, TokenPricing>>((acc, [address, value]) => {
      const decimals = Number(value?.decimals)
      const usd = Number(value?.usd)
      if (Number.isInteger(decimals) && decimals >= 0 && decimals <= 30 && Number.isFinite(usd) && usd > 0) {
        acc[normalizeAddress(address)] = { decimals, usd }
      }
      return acc
    }, {})
  } catch (error) {
    console.error("SWAPHUB_TOKEN_PRICES_JSON parse error:", error)
    return {}
  }
}

function getTokenPricing(tokenAddress: string): TokenPricing | null {
  const token = normalizeAddress(tokenAddress)
  const overrides = parseTokenPriceOverrides()
  if (overrides[token]) return overrides[token]

  if (token === ZERO_ADDRESS || token === WETH_ADDRESS) {
    return { decimals: 18, usd: getEthUsdPrice() }
  }
  if (token === USDC_ADDRESS || token === USDBC_ADDRESS) {
    return { decimals: 6, usd: 1 }
  }
  if (token === DAI_ADDRESS) {
    return { decimals: 18, usd: 1 }
  }

  return null
}

function decodeAddressTopic(topic?: string): string {
  if (!topic || typeof topic !== "string" || !topic.startsWith("0x")) return ""
  const clean = topic.replace(/^0x/, "").padStart(64, "0")
  return normalizeAddress(`0x${clean.slice(-40)}`)
}

function decodeHexBigInt(value?: string): bigint {
  if (!value || typeof value !== "string" || !value.startsWith("0x")) return 0n
  try {
    return BigInt(value)
  } catch (_) {
    return 0n
  }
}

function getVerifiedErc20InputAmount(receipt: TxReceipt, tokenIn: string, wallet: string, expectedAmount: bigint): bigint {
  let total = 0n
  for (const log of receipt.logs ?? []) {
    const token = normalizeAddress(log.address || "")
    const topics = log.topics ?? []
    if (token !== tokenIn) continue
    if (normalizeAddress(topics[0] || "") !== ERC20_TRANSFER_TOPIC) continue

    const from = decodeAddressTopic(topics[1])
    const to = decodeAddressTopic(topics[2])
    if (from !== wallet || !to || to === wallet) continue

    total += decodeHexBigInt(log.data)
  }

  return total >= expectedAmount ? total : 0n
}

function getVerifiedSwapAmountUsd(swapCall: ParsedSwapCall, tx: RpcTransaction, receipt: TxReceipt, wallet: string): {
  amountUsd: number
  verifiedInputAmount: bigint
} {
  if (swapCall.amountIn <= 0n) {
    throw new Error("SwapHub amount is zero")
  }

  if (swapCall.tokenIn === ZERO_ADDRESS) {
    const txValueWei = BigInt(tx.value || "0x0")
    if (txValueWei <= 0n || swapCall.amountIn > txValueWei) {
      throw new Error("SwapHub amount does not match transaction value")
    }
    return {
      amountUsd: weiToEthNumber(swapCall.amountIn) * getEthUsdPrice(),
      verifiedInputAmount: swapCall.amountIn,
    }
  }

  const pricing = getTokenPricing(swapCall.tokenIn)
  if (!pricing) {
    throw new Error("Unsupported SwapHub token price")
  }

  const verifiedInputAmount = getVerifiedErc20InputAmount(receipt, swapCall.tokenIn, wallet, swapCall.amountIn)
  if (verifiedInputAmount <= 0n) {
    throw new Error("SwapHub ERC20 input transfer was not found on-chain")
  }

  return {
    amountUsd: tokenAmountToNumber(verifiedInputAmount, pricing.decimals) * pricing.usd,
    verifiedInputAmount,
  }
}

// Per-$100 XP and milestone tiers (must match xpUtils.js constants)
const SWAP_PER_100_XP = 5000
const SWAP_PER_100_GAME_TYPE = "SWAP_PER_100"
const SWAP_VOLUME_TIERS = [
  { threshold: 1000, xp: 50000, key: "SWAP_MILESTONE_1K" },
  { threshold: 10000, xp: 500000, key: "SWAP_MILESTONE_10K" },
  { threshold: 100000, xp: 5000000, key: "SWAP_MILESTONE_100K" },
  { threshold: 1000000, xp: 50000000, key: "SWAP_MILESTONE_1M" },
]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { wallet_address, swap_amount_usd, tx_hash, source } = body as {
      wallet_address?: string
      swap_amount_usd?: number
      tx_hash?: string
      source?: string
    }

    if (!wallet_address || swap_amount_usd == null || !tx_hash) {
      return new Response(
        JSON.stringify({ error: "Missing wallet_address, swap_amount_usd, or tx_hash" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const wallet = normalizeAddress(wallet_address)
    if (!wallet) {
      return new Response(JSON.stringify({ error: "Invalid wallet_address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const submittedAmount = typeof swap_amount_usd === "number" ? swap_amount_usd : parseFloat(String(swap_amount_usd)) || 0
    if (submittedAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid swap_amount_usd" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // On-chain verification: Base chain only (SwapHub runs on Base)
    await new Promise((r) => setTimeout(r, 3000))
    let receipt: TxReceipt | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      receipt = await getTransactionReceipt(tx_hash)
      if (receipt) break
      await new Promise((r) => setTimeout(r, 2500))
    }

    if (!receipt) {
      return new Response(JSON.stringify({ error: "Transaction not found or not yet mined" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const statusOk = receipt.status === "0x1" || receipt.status === "1" || (receipt.status as unknown) === 1
    if (!statusOk) {
      return new Response(JSON.stringify({ error: "Transaction failed on-chain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const fromAddr = receipt.from ? normalizeAddress(receipt.from) : ""
    if (fromAddr && fromAddr !== wallet) {
      return new Response(JSON.stringify({ error: "Transaction from address does not match wallet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const tx = await getTransaction(tx_hash)
    if (!tx) {
      return new Response(JSON.stringify({ error: "Transaction details not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const txTo = normalizeAddress(tx.to || receipt.to || "")
    if (!SWAPHUB_AGGREGATORS.has(txTo)) {
      return new Response(JSON.stringify({ error: "Transaction is not a SwapHub swap" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const swapCall = parseAggregatorSwapCall(tx.input)
    if (!swapCall) {
      return new Response(JSON.stringify({ error: "Unsupported SwapHub swap call" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let verifiedAmount = 0
    try {
      verifiedAmount = getVerifiedSwapAmountUsd(swapCall, tx, receipt, wallet).amountUsd
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "SwapHub verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0 || verifiedAmount > MAX_VERIFIED_SWAP_USD) {
      return new Response(JSON.stringify({ error: "Verified SwapHub volume is outside allowed limits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const maxSubmittedAmount =
      verifiedAmount * (1 + SUBMITTED_AMOUNT_TOLERANCE) + SUBMITTED_AMOUNT_ABSOLUTE_TOLERANCE
    if (submittedAmount > maxSubmittedAmount) {
      return new Response(JSON.stringify({ error: "Submitted SwapHub volume exceeds verified on-chain value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const amount = verifiedAmount

    // Supabase client with service role for DB writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Check duplicate: same tx_hash in swaphub_swaps
    const { data: existing } = await supabase
      .from("swaphub_swaps")
      .select("id")
      .eq("tx_hash", tx_hash)
      .limit(1)
    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Swap already recorded", xpFromPer100: 0, xpFromMilestones: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Insert swap record
    const { error: insertErr } = await supabase
      .from("swaphub_swaps")
      .insert({
        wallet_address: wallet,
        amount_usd: amount,
        tx_hash,
        created_at: new Date().toISOString(),
      })
    if (insertErr) {
      console.error("swaphub_swaps insert error:", insertErr)
    }

    // Upsert volume
    const { data: volRow } = await supabase
      .from("swaphub_volume")
      .select("total_volume_usd")
      .eq("wallet_address", wallet)
      .maybeSingle()

    const prevVolume = parseFloat(volRow?.total_volume_usd ?? "0") || 0
    const newVolume = prevVolume + amount

    const { error: volErr } = await supabase
      .from("swaphub_volume")
      .upsert(
        { wallet_address: wallet, total_volume_usd: newVolume, updated_at: new Date().toISOString() },
        { onConflict: "wallet_address" }
      )
    if (volErr) {
      console.error("swaphub_volume upsert error:", volErr)
    }

    // Determine source for XP routing (web -> transactions, farcaster/base_app -> miniapp_transactions)
    const pSource = source === "farcaster" || source === "base_app" ? source : "web"

    // Award XP: per-$100 blocks
    let xpFromPer100 = 0
    const prevBlocks = Math.floor(prevVolume / 100)
    const newBlocks = Math.floor(newVolume / 100)
    for (let b = prevBlocks + 1; b <= newBlocks; b++) {
      const { error: xpErr } = await supabase.rpc("award_xp", {
        p_wallet_address: wallet,
        p_final_xp: SWAP_PER_100_XP,
        p_game_type: SWAP_PER_100_GAME_TYPE,
        p_transaction_hash: tx_hash,
        p_source: pSource,
      })
      if (!xpErr) {
        xpFromPer100 += SWAP_PER_100_XP
      } else {
        console.error(`award_xp per-$100 block ${b} error:`, xpErr)
      }
    }

    // Award XP: milestone bonuses
    let xpFromMilestones = 0
    for (const tier of SWAP_VOLUME_TIERS) {
      if (newVolume < tier.threshold) continue
      if (prevVolume >= tier.threshold) continue

      const { error: mErr } = await supabase.rpc("award_xp", {
        p_wallet_address: wallet,
        p_final_xp: tier.xp,
        p_game_type: tier.key,
        p_transaction_hash: tx_hash,
        p_source: pSource,
      })
      if (!mErr) {
        xpFromMilestones += tier.xp
      } else {
        console.error(`award_xp milestone ${tier.key} error:`, mErr)
      }
    }

    return new Response(
      JSON.stringify({ success: true, xpFromPer100, xpFromMilestones }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
