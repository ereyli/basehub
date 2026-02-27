import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { defineChain, fallback, http as viemHttp } from 'viem'
import { injected, metaMask } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { NETWORKS } from './networks'

// Base Builder Code – ERC-8021 attribution (base.dev → Settings → Builder Code).
// Base app / Farcaster miniapp’te kullanıcılar çoğunlukla akıllı kontrat cüzdanı (Base Account vb.) kullanıyor.
// - writeContract / writeContractAsync: her çağrıda dataSuffix: DATA_SUFFIX veriyoruz → tx data’ya suffix eklenir, cüzdan aynen gönderirse attribution olur.
// - EIP-5792 sendCalls kullanılırsa (batch): capabilities: BUILDER_CODE_CAPABILITIES geçilmeli.
// Schema 0: codesHex + codesLength(1) + schemaId(0) + ercMarker(16 bytes). Inline to avoid ox package resolution on Vercel.
export const DATA_SUFFIX = '0x62635f6372386f6d7866660b0080218021802180218021802180218021'

/** EIP-5792 sendCalls için capabilities – akıllı cüzdanlarda Builder Code attribution. sendCalls({ calls, capabilities: BUILDER_CODE_CAPABILITIES }). */
export const BUILDER_CODE_CAPABILITIES = {
  dataSuffix: { value: DATA_SUFFIX, optional: true },
}

// InkChain chain definition
const inkChain = defineChain({
  id: NETWORKS.INKCHAIN.chainId,
  name: NETWORKS.INKCHAIN.chainName,
  nativeCurrency: NETWORKS.INKCHAIN.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.INKCHAIN.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'InkChain Explorer',
      url: NETWORKS.INKCHAIN.blockExplorerUrls[0],
    },
  },
})

// Soneium chain definition
const soneium = defineChain({
  id: NETWORKS.SONEIUM.chainId,
  name: NETWORKS.SONEIUM.chainName,
  nativeCurrency: NETWORKS.SONEIUM.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.SONEIUM.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Soneium Explorer',
      url: NETWORKS.SONEIUM.blockExplorerUrls[0],
    },
  },
})

// Katana chain definition
const katana = defineChain({
  id: NETWORKS.KATANA.chainId,
  name: NETWORKS.KATANA.chainName,
  nativeCurrency: NETWORKS.KATANA.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.KATANA.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Katana Explorer',
      url: NETWORKS.KATANA.blockExplorerUrls[0],
    },
  },
})

// MegaETH mainnet
const megaeth = defineChain({
  id: NETWORKS.MEGAETH.chainId,
  name: NETWORKS.MEGAETH.chainName,
  nativeCurrency: NETWORKS.MEGAETH.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.MEGAETH.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'MegaETH Explorer',
      url: NETWORKS.MEGAETH.blockExplorerUrls[0],
    },
  },
})

// Arc Testnet - USDC as native/gas
const arcRestnet = defineChain({
  id: NETWORKS.ARC_RESTNET.chainId,
  name: NETWORKS.ARC_RESTNET.chainName,
  nativeCurrency: NETWORKS.ARC_RESTNET.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.ARC_RESTNET.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Scan',
      url: NETWORKS.ARC_RESTNET.blockExplorerUrls[0],
    },
  },
})

// Robinhood Chain Testnet
const robinhoodTestnet = defineChain({
  id: NETWORKS.ROBINHOOD_TESTNET.chainId,
  name: NETWORKS.ROBINHOOD_TESTNET.chainName,
  nativeCurrency: NETWORKS.ROBINHOOD_TESTNET.nativeCurrency,
  rpcUrls: {
    default: {
      http: NETWORKS.ROBINHOOD_TESTNET.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Explorer',
      url: NETWORKS.ROBINHOOD_TESTNET.blockExplorerUrls[0],
    },
  },
})

// Wagmi config with multiple wallet support
export const config = createConfig({
  chains: [base, inkChain, soneium, katana, megaeth, arcRestnet, robinhoodTestnet],
  dataSuffix: DATA_SUFFIX,
  transports: {
    [base.id]: fallback(
      NETWORKS.BASE.rpcUrls.map((url) => viemHttp(url, { timeout: 20000, retryCount: 3, retryDelay: 1500 }))
    ),
    [inkChain.id]: fallback(
      NETWORKS.INKCHAIN.rpcUrls.map((url) => viemHttp(url, { timeout: 30000, retryCount: 2, retryDelay: 1000 }))
    ),
    [soneium.id]: fallback(
      NETWORKS.SONEIUM.rpcUrls.map((url) => viemHttp(url, { timeout: 30000, retryCount: 2, retryDelay: 1000 }))
    ),
    [katana.id]: http(NETWORKS.KATANA.rpcUrls[0], {
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    }),
    [megaeth.id]: http(NETWORKS.MEGAETH.rpcUrls[0], {
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    }),
    [arcRestnet.id]: http(NETWORKS.ARC_RESTNET.rpcUrls[0], {
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    }),
    [robinhoodTestnet.id]: http(NETWORKS.ROBINHOOD_TESTNET.rpcUrls[0], {
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    }),
  },
  connectors: [
    // Farcaster Mini App connector (only works on Base)
    farcasterMiniApp(),
    // Other wallet connectors for web
    injected(),
    metaMask(),
  ],
})

// Helper function to get preferred connector
export const getPreferredConnector = (connectors) => {
  // Check if we're in Farcaster
  if (isInFarcaster()) {
    return connectors.find(connector => connector.id === 'farcasterMiniApp')
  }
  
  // For web, prefer MetaMask
  return connectors.find(connector => connector.id === 'metaMask') || connectors[0]
}

// Helper function to check if we're in Farcaster
export const isInFarcaster = () => {
  return typeof window !== 'undefined' && 
         window.location !== window.parent.location &&
         window.parent !== window
}

console.log('✅ Wagmi configured with multiple wallet support')