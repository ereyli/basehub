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

const SWAPHUB_AGGREGATOR = "0xbf579e68ba69de03ccec14476eb8d765ec558257"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const SWAP_V2_SELECTOR = "0x83b82a53"
const SWAP_V3_SELECTOR = "0x6b9262dc"
const DEFAULT_ETH_USD = 3500
const MAX_VERIFIED_SWAP_USD = 1000
const SUBMITTED_AMOUNT_TOLERANCE = 0.1
const SUBMITTED_AMOUNT_ABSOLUTE_TOLERANCE = 0.05

type TxReceipt = {
  status: string
  from?: string
  to?: string
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
  amountInWei: bigint
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
      amountInWei: decodeUintWord(getCallWord(input, 2)),
    }
  }

  if (selector === SWAP_V3_SELECTOR) {
    return {
      selector,
      tokenIn: decodeAddressWord(getCallWord(input, 0)),
      tokenOut: decodeAddressWord(getCallWord(input, 1)),
      amountInWei: decodeUintWord(getCallWord(input, 3)),
    }
  }

  return null
}

function weiToEthNumber(valueWei: bigint): number {
  return Number(valueWei) / 1e18
}

function getEthUsdPrice(): number {
  const raw = Deno.env.get("SWAPHUB_ETH_USD_FALLBACK") || Deno.env.get("ETH_USD_FALLBACK")
  const parsed = raw ? Number(raw) : DEFAULT_ETH_USD
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ETH_USD
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
    if (txTo !== SWAPHUB_AGGREGATOR) {
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

    if (swapCall.tokenIn !== ZERO_ADDRESS) {
      return new Response(JSON.stringify({ error: "Only native ETH SwapHub volume is eligible for XP right now" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const txValueWei = BigInt(tx.value || "0x0")
    if (txValueWei <= 0n || swapCall.amountInWei <= 0n || swapCall.amountInWei > txValueWei) {
      return new Response(JSON.stringify({ error: "SwapHub amount does not match transaction value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const verifiedAmount = weiToEthNumber(swapCall.amountInWei) * getEthUsdPrice()
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
