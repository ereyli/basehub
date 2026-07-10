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
  4663: "https://rpc.mainnet.chain.robinhood.com",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  143: "https://rpc.monad.xyz",
  4326: "https://mainnet.megaeth.com/rpc",
  4217: "https://rpc.tempo.xyz",
}

type ReceiptLog = { address?: string; topics?: string[] }
type VerifiedReceipt = { status: string; from?: string; to?: string; logs: ReceiptLog[] }

const EVENT_TOPICS: Record<string, string[]> = {
  PUMPHUB_TOKEN_CREATION: ["0x0634dfbd09c790b2e9ee2ad4ab933e4bebd7380bf27b2a5a4ba64302b7ab9d22"],
  PUMPHUB_BUY: ["0xea19975543ce6241584c3c9e8f620c9937d2d9c1563deddf21cbc8c14db464fd"],
  PUMPHUB_SELL: ["0xce56b310ee789dd2ea36cb33086c97315fb7699c103422586f6e5f9f94f45b5e"],
  "B20 Deployment": [
    "0xf67937dd4f683fb10e53f88c4f58f168c99e8619cac4d9fd9ed8d87c188512bd",
    "0x74faaff3b14b7a15bf8b7d490cbcba1285c73d2138386c8b6f3dffd02840ab72",
  ],
}

const BUILTIN_GAME_TARGETS: Record<string, Record<number, string[]>> = {
  PUMPHUB_TOKEN_CREATION: {
    8453: ["0xe7c2fe007c65349c91b8ccac3c5be5a7f2fdaf21"],
    4663: ["0x1ceb5264e638a76c8704612811b9976cb30d0883"],
  },
  PUMPHUB_BUY: {
    8453: ["0xe7c2fe007c65349c91b8ccac3c5be5a7f2fdaf21"],
    4663: ["0x1ceb5264e638a76c8704612811b9976cb30d0883"],
  },
  PUMPHUB_SELL: {
    8453: ["0xe7c2fe007c65349c91b8ccac3c5be5a7f2fdaf21"],
    4663: ["0x1ceb5264e638a76c8704612811b9976cb30d0883"],
  },
  "B20 Deployment": {
    8453: [
      "0x166011ab63aa872cf9e1d7d0f7a1ddfa32e2f7b9",
      "0x71e90f79b07c42daf99c5bbed1b5e5c7b52a2129",
    ],
    84532: [
      "0x1ceb5264e638a76c8704612811b9976cb30d0883",
      "0xceec271c573243a7e8faf47c5a2ccef223396bd9",
    ],
  },
}

function getConfiguredTargets(gameType: string, chainId: number): string[] {
  const builtin = BUILTIN_GAME_TARGETS[gameType]?.[chainId] || []
  try {
    const parsed = JSON.parse(Deno.env.get("XP_GAME_TARGETS_JSON") || "{}")
    const configured = parsed?.[gameType]?.[String(chainId)]
    if (Array.isArray(configured)) return [...builtin, ...configured].map(normalizeAddress)
  } catch (_) { /* invalid optional override; use built-ins */ }
  return builtin.map(normalizeAddress)
}

async function getTransactionReceipt(txHash: string, chainId: number): Promise<VerifiedReceipt | null> {
  const rpc = CHAIN_RPC[chainId]
  if (!rpc) return null
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
    if (!receipt) return null
    const status = receipt.status != null ? String(receipt.status) : ""
    return { status, from: receipt.from, to: receipt.to, logs: Array.isArray(receipt.logs) ? receipt.logs : [] }
  } catch (_) {
    return null
  }
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

    const chainIdNum = Number(chain_id)
    if (!CHAIN_RPC[chainIdNum]) {
      return new Response(JSON.stringify({ error: "Unsupported chain for XP verification" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

      await new Promise((r) => setTimeout(r, 1500))
      let receipt: VerifiedReceipt | null = null
      for (let attempt = 0; attempt < 8; attempt++) {
        receipt = await getTransactionReceipt(tx_hash, chainIdNum)
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

      const expectedTargets = getConfiguredTargets(game_type, chainIdNum)
      const expectedTopics = EVENT_TOPICS[game_type] || []
      if (expectedTargets.length > 0 || expectedTopics.length > 0) {
        const matchingLog = receipt.logs.some((log) => {
          const logAddress = normalizeAddress(log?.address || "")
          const topic0 = String(log?.topics?.[0] || "").toLowerCase()
          const addressOk = expectedTargets.length === 0 || expectedTargets.includes(logAddress)
          const topicOk = expectedTopics.length === 0 || expectedTopics.includes(topic0)
          return addressOk && topicOk
        })
        if (!matchingLog) {
          return new Response(JSON.stringify({ error: "Transaction does not match the requested BaseHub action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
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
