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

async function getTransactionReceipt(txHash: string): Promise<{ status: string; from?: string } | null> {
  for (const rpc of BASE_RPC_URLS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
          id: 1,
        }),
      })
      const json = await res.json()
      const receipt = json?.result
      if (receipt) {
        return { status: receipt.status != null ? String(receipt.status) : "", from: receipt.from }
      }
    } catch (_) {
      // try next RPC
    }
  }
  return null
}

function normalizeAddress(addr: string): string {
  if (!addr || typeof addr !== "string") return ""
  return addr.toLowerCase().trim()
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

    const amount = typeof swap_amount_usd === "number" ? swap_amount_usd : parseFloat(String(swap_amount_usd)) || 0
    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid swap_amount_usd" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // On-chain verification: Base chain only (SwapHub runs on Base)
    await new Promise((r) => setTimeout(r, 3000))
    let receipt: { status: string; from?: string } | null = null
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
