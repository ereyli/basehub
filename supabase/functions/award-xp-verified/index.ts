// award-xp-verified: tx receipt doğrulaması + award_xp RPC (p_source ile web/miniapp ayrımı)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const CHAIN_RPC: Record<number, string> = {
  8453: "https://mainnet.base.org",
  57073: "https://rpc-qnd.inkonchain.com",
  1868: "https://rpc.soneium.org",
  747474: "https://rpc.katana.network",
  4326: "https://mainnet.megaeth.com/rpc",
}

async function getTransactionReceipt(txHash: string, chainId: number): Promise<{ status: string; from?: string } | null> {
  const rpc = CHAIN_RPC[chainId] || CHAIN_RPC[8453]
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
  if (!receipt) return null
  return { status: receipt.status, from: receipt.from }
}

function normalizeAddress(addr: string): string {
  if (!addr || typeof addr !== "string") return ""
  return addr.toLowerCase().trim()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      wallet_address,
      game_type,
      xp_amount,
      tx_hash,
      chain_id,
      source,
    } = body as {
      wallet_address?: string
      game_type?: string
      xp_amount?: number
      tx_hash?: string
      chain_id?: number
      source?: string
    }

    if (!wallet_address || !game_type || xp_amount == null || !tx_hash || chain_id == null) {
      return new Response(
        JSON.stringify({ error: "Missing wallet_address, game_type, xp_amount, tx_hash, or chain_id" }),
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

    // 3s gecikme (RPC propagation) + receipt için kısa retry
    await new Promise((r) => setTimeout(r, 3000))
    let receipt: { status: string; from?: string } | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      receipt = await getTransactionReceipt(tx_hash, Number(chain_id))
      if (receipt) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    if (!receipt) {
      return new Response(JSON.stringify({ error: "Transaction not found or not yet mined" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const statusOk = receipt.status === "0x1" || receipt.status === 1 || receipt.status === "1"
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

    const pSource = source === "farcaster" || source === "base_app" ? source : "web"
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const { data, error } = await supabase.rpc("award_xp", {
      p_wallet_address: wallet,
      p_final_xp: Math.round(Number(xp_amount)),
      p_game_type: game_type,
      p_transaction_hash: tx_hash,
      p_source: pSource,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const newTotalXP = data?.new_total_xp ?? xp_amount
    return new Response(JSON.stringify({ success: true, new_total_xp: newTotalXP }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
