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

const BASE_CHAIN_ID = 8453
const EARLY_ACCESS_NFT = "0x2f2b186b666dd58d80e0b062a65f6ebd43a3cec1"
const BALANCE_OF_SELECTOR = "0x70a08231"

const EVENT_TOPICS: Record<string, string[]> = {
  GM_GAME: ["0x46cf23f4df6e34711928d10f189d7fe550f0da387b765dd6239ff971de13f59a"],
  GN_GAME: ["0x08a8d7a46107f76a526d33a76ad5d84c0bd3f336424e2a58b40219a9aae7c7c4"],
  FLIP_GAME: ["0xa3c4d48e9d25846218ebd004c737abc0e9417520d32fef8111f49d6490e1c9c8"],
  LUCKY_NUMBER: ["0x311cd3c5a5c55369c08de41345da43a15222f9c5929a02c3dd64eeb42ec5fddb"],
  DICE_ROLL: ["0x9e3b224b9cffc699a7d8d36f155d6b74e7cbf38a41cb8b1250598402e578111e"],
  SLOT_GAME: ["0x054fcd888c6799384203ce258d177aa2f38f0e5cbe43fc2a39e9bfeba56824e9"],
  SLOT_GAME_CREDITS: ["0xfb82fc1c5adf84899709e87563b69dd5f4ac33320f1c60dbca744bec717eb90f"],
  PUMPHUB_TOKEN_CREATION: ["0x0634dfbd09c790b2e9ee2ad4ab933e4bebd7380bf27b2a5a4ba64302b7ab9d22"],
  PUMPHUB_BUY: ["0xea19975543ce6241584c3c9e8f620c9937d2d9c1563deddf21cbc8c14db464fd"],
  PUMPHUB_SELL: ["0xce56b310ee789dd2ea36cb33086c97315fb7699c103422586f6e5f9f94f45b5e"],
  "B20 Deployment": [
    "0xf67937dd4f683fb10e53f88c4f58f168c99e8619cac4d9fd9ed8d87c188512bd",
    "0x74faaff3b14b7a15bf8b7d490cbcba1285c73d2138386c8b6f3dffd02840ab72",
  ],
}

const BUILTIN_GAME_TARGETS: Record<string, Record<number, string[]>> = {
  GM_GAME: {
    8453: ["0xc3ea6f7b014c6d9c4c421ba5bcea3bd25f97f623"],
    57073: ["0x5e86e9cd50e7f64b692b90fae1487d2f6ed1aba9"],
    1868: ["0x5e86e9cd50e7f64b692b90fae1487d2f6ed1aba9"],
    747474: ["0x74a2c6466d98253ca932fe6a6ccb811d4d7d5784"],
    4326: ["0x84e4dd821c8f848470fc49def3b14fc870fa97f0"],
    4217: ["0x90bb363ba2441fb4a9a0b49d1d5e8e7ab413c9d6"],
    4663: ["0x166011ab63aa872cf9e1d7d0f7a1ddfa32e2f7b9"],
    42161: ["0x166011ab63aa872cf9e1d7d0f7a1ddfa32e2f7b9"],
    10: ["0x166011ab63aa872cf9e1d7d0f7a1ddfa32e2f7b9"],
    143: ["0x166011ab63aa872cf9e1d7d0f7a1ddfa32e2f7b9"],
  },
  GN_GAME: {
    8453: ["0xecd289ea7ab254bd53062a26f377f146a624f133"],
    57073: ["0x1fe43a182b2a4a5845b91ba29cd7e7eebc4b68df"],
    1868: ["0x1fe43a182b2a4a5845b91ba29cd7e7eebc4b68df"],
    747474: ["0x84e4dd821c8f848470fc49def3b14fc870fa97f0"],
    4326: ["0x5e86e9cd50e7f64b692b90fae1487d2f6ed1aba9"],
    4217: ["0x62eea88cbad6146ce75d30d692ead0de799e98c3"],
    4663: ["0x71e90f79b07c42daf99c5bbed1b5e5c7b52a2129"],
    42161: ["0x71e90f79b07c42daf99c5bbed1b5e5c7b52a2129"],
    10: ["0x71e90f79b07c42daf99c5bbed1b5e5c7b52a2129"],
    143: ["0x71e90f79b07c42daf99c5bbed1b5e5c7b52a2129"],
  },
  FLIP_GAME: {
    8453: ["0x9be475499498f0e07bc3d89a91d8de1b97a036b6"],
    57073: ["0x933570b7a6b872e1be0a1585aaccdbf609c5f981"],
    1868: ["0x933570b7a6b872e1be0a1585aaccdbf609c5f981"],
    747474: ["0x933570b7a6b872e1be0a1585aaccdbf609c5f981"],
    4326: ["0x74a2c6466d98253ca932fe6a6ccb811d4d7d5784"],
    4217: ["0x3ce4abc8c6921cd84c76848200d35ba70609ab69"],
    4663: ["0x2bcf075c5876385fe191d0a471fe53d6f6fa8b05"],
    42161: ["0x2bcf075c5876385fe191d0a471fe53d6f6fa8b05"],
    10: ["0x2bcf075c5876385fe191d0a471fe53d6f6fa8b05"],
    143: ["0x2bcf075c5876385fe191d0a471fe53d6f6fa8b05"],
  },
  LUCKY_NUMBER: {
    8453: ["0x48ff955604a44d5dbbf1e6c0fd8924cb99d46ef0"],
    57073: ["0xa15ce1eada8e34ec67d82f8d7ab242a42c767c2d"],
    1868: ["0xa15ce1eada8e34ec67d82f8d7ab242a42c767c2d"],
    747474: ["0xa15ce1eada8e34ec67d82f8d7ab242a42c767c2d"],
    4326: ["0xa15ce1eada8e34ec67d82f8d7ab242a42c767c2d"],
    4217: ["0x71a625487dc88fa1be54ec8bd96e240acdaf8fb0"],
    4663: ["0x4873c6a524c47fee05f2839c308553bc8c09bc47"],
    42161: ["0x4873c6a524c47fee05f2839c308553bc8c09bc47"],
    10: ["0x4873c6a524c47fee05f2839c308553bc8c09bc47"],
    143: ["0x4873c6a524c47fee05f2839c308553bc8c09bc47"],
  },
  DICE_ROLL: {
    8453: ["0xb8c1d2c73ec319b9484944c4e1ea7c1cc93ec2c2"],
    57073: ["0x74a2c6466d98253ca932fe6a6ccb811d4d7d5784"],
    1868: ["0x74a2c6466d98253ca932fe6a6ccb811d4d7d5784"],
    747474: ["0xcaa2a1fb271ae0a04415654e62fb26bdd1adac64"],
    4326: ["0x933570b7a6b872e1be0a1585aaccdbf609c5f981"],
    4217: ["0xc4a94dabedb0db43354874c67814c226391452b8"],
    4663: ["0xcd8cbac71195fe2f2a81dbbbe4ae4fff5278102c"],
    42161: ["0xcd8cbac71195fe2f2a81dbbbe4ae4fff5278102c"],
    10: ["0xcd8cbac71195fe2f2a81dbbbe4ae4fff5278102c"],
    143: ["0xcd8cbac71195fe2f2a81dbbbe4ae4fff5278102c"],
  },
  SLOT_GAME: {
    8453: ["0xbdae561fcad053902402f3d000cabc9806a6f3c1"],
    57073: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    1868: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    747474: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    4326: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    4217: ["0x9e54449dd4c042279aa454710481cf33e15d8cb7"],
    4663: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
    42161: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
    10: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
    143: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
  },
  SLOT_GAME_CREDITS: {
    8453: ["0xbdae561fcad053902402f3d000cabc9806a6f3c1"],
    57073: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    1868: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    747474: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    4326: ["0xb2b2c587e51175a2ae4713d8ea68a934a8527a4b"],
    4217: ["0x9e54449dd4c042279aa454710481cf33e15d8cb7"],
    4663: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
    42161: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
    10: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
    143: ["0xc64006e31dd09df82b6513a9cba20a52341ef1db"],
  },
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

const TX_REWARD_BASE_XP: Record<string, number> = {
  GM_GAME: 150,
  GN_GAME: 150,
  FLIP_GAME: 650,
  LUCKY_NUMBER: 1150,
  DICE_ROLL: 1650,
  SLOT_GAME: 2150,
  SLOT_GAME_CREDITS: 10,
  "Token Deployment": 850,
  "ERC721 Deployment": 850,
  "ERC1155 Deployment": 850,
  "NFT Deployment": 850,
  NFT_LAUNCHPAD_COLLECTION: 2000,
  NFT_LAUNCHPAD_MINT: 200,
  "Early Access NFT Mint": 3000,
  AI_NFT_MINTING: 500,
  "AI NFT Minting": 500,
  "B20 Deployment": 5000,
  "ERC8004 Agent Registration": 5000,
  ALLOWANCE_CLEANER: 300,
  WALLET_ANALYSIS: 400,
  CONTRACT_SECURITY: 500,
  PUMPHUB_TOKEN_CREATION: 2000,
  PUMPHUB_BUY: 100,
  PUMPHUB_SELL: 100,
  X402_PAYMENT: 500,
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

function addressToTopic(addr: string): string {
  const normalized = normalizeAddress(addr).replace(/^0x/, "")
  return `0x${normalized.padStart(64, "0")}`
}

function hasWalletActionLog(receipt: VerifiedReceipt, gameType: string, chainId: number, wallet: string): boolean {
  const expectedTargets = getConfiguredTargets(gameType, chainId)
  const expectedTopics = EVENT_TOPICS[gameType] || []
  if (expectedTargets.length === 0 || expectedTopics.length === 0) return false

  const walletTopic = addressToTopic(wallet)
  return receipt.logs.some((log) => {
    const logAddress = normalizeAddress(log?.address || "")
    const topic0 = String(log?.topics?.[0] || "").toLowerCase()
    const topic1 = String(log?.topics?.[1] || "").toLowerCase()
    return expectedTargets.includes(logAddress)
      && expectedTopics.includes(topic0)
      && topic1 === walletTopic
  })
}

async function rpcRequest(chainId: number, method: string, params: unknown[]) {
  const rpc = CHAIN_RPC[chainId]
  if (!rpc) throw new Error("Unsupported chain")
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  })
  const json = await res.json()
  if (json?.error) throw new Error(json.error?.message || "RPC request failed")
  return json?.result
}

async function getEarlyAccessNftCount(wallet: string): Promise<number> {
  const callData = `${BALANCE_OF_SELECTOR}${normalizeAddress(wallet).replace(/^0x/, "").padStart(64, "0")}`
  const result = await rpcRequest(BASE_CHAIN_ID, "eth_call", [{ to: EARLY_ACCESS_NFT, data: callData }, "latest"])
  if (!result || typeof result !== "string") return 0
  return Number(BigInt(result))
}

async function getAllowedXpAmount(gameType: string, wallet: string): Promise<number | null> {
  const baseXp = TX_REWARD_BASE_XP[gameType]
  if (!baseXp) return null

  const nftCount = await getEarlyAccessNftCount(wallet)
  const multiplier = Math.min(Math.max(nftCount, 0), 10) + 1
  return baseXp * multiplier
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

      const requestedXp = Math.round(Number(xp_amount))
      const allowedXp = await getAllowedXpAmount(game_type, wallet)
      if (allowedXp != null && (requestedXp <= 0 || requestedXp > allowedXp)) {
        return new Response(JSON.stringify({ error: `XP amount ${requestedXp} exceeds verified maximum ${allowedXp}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const fromAddr = receipt.from ? normalizeAddress(receipt.from) : ""
      const walletActionLogOk = hasWalletActionLog(receipt, game_type, chainIdNum, wallet)
      if (fromAddr && fromAddr !== wallet && !walletActionLogOk) {
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
