import { parseAbi, toEventSelector, toFunctionSelector } from 'viem'
export const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
export const ZERO = '0x0000000000000000000000000000000000000000'
export const FACTORY = '0xb20f000000000000000000000000000000000000'
export const BRIDGE = '0x4200000000000000000000000000000000000010'
export const IDENTITY = '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
export const ENTRY_POINTS = new Set([
  '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
  '0x0000000071727de22e5e9d8baf0edac6f37da032',
  '0x4337084d9e255ff0702461cf8895ce9e3b5ff108',
  '0x433709009b8330fda32311df1c2afa402ed8d009',
])
export const X402_PROXIES = new Set([
  '0x402085c248eea27d92e8b30b2c58ed07f9e20001',
  '0x4020a4f3b7b90cca423b9fabcc0ce57c6c240002',
])
export const SPIKO = new Map([
  ['0xe4880249745eac5f1ed9d8f7df844792d560e750', 'USTBL'],
  ['0xa0769f7a8fc65e47de93797b4e21c073c117fc80', 'EUTBL'],
  ['0xa8de1f55aa0e381cb456e1dcc9ff781ea0079068', 'UKTBL'],
  ['0xf695df6c0f3bb45918a7a82e83348fc59517734e', 'SPKCC'],
  ['0x4f33acf823e6eeb697180d553ce0c710124c8d59', 'eurSPKCC'],
])
const STOCK_FALLBACK = new Map([
  ['0xb200000000000000000000c2e324d24d7eecd1fb', 'AAPLc'],
  ['0xb20000000000000000000078ee7ce2fe4908108c', 'NVDAc'],
  ['0xb2000000000000000000008bc8786b856e61707c', 'METAc'],
  ['0xb2000000000000000000002d0ba3164cc74f58b7', 'GOOGLc'],
])
export const B20_LAUNCHERS = new Set(['0x166011ab63aa872cf9e1d7d0f7a1ddfa32e2f7b9', '0x71e90f79b07c42daf99c5bbed1b5e5c7b52a2129',
  process.env.VITE_B20_LAUNCHER_BASE, process.env.VITE_B20_CURVE_LAUNCHPAD_BASE].filter(Boolean).map((a) => a.toLowerCase()))

export const ADDRESS = /^0x[\da-f]{40}$/i
export const HASH = /^0x[\da-f]{64}$/i
export const B20_CANDIDATE = /^0xb20000000000000000000[01][\da-f]{18}$/
const dexRouters = [
  ['0x2626664c2603336e57b271c5c0b26f421741e481', 'Uniswap'],
  ['0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', 'Uniswap'],
  ['0x6ff5693b99212da76ad316178a184ab56d299b43', 'Uniswap'],
  ['0x1b81d678ffb9c0263b24a97847620c99d213eb14', 'PancakeSwap'],
  ['0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43', 'Aerodrome'],
  ['0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5', 'Aerodrome'],
  ['0x645a71b8e06c1979e0f140b1cea68ffa5efbc497', 'SwapHub'],
  [process.env.VITE_SWAP_AGGREGATOR_ADDRESS, 'SwapHub'],
]
export const DEX = new Map(dexRouters.filter(([address]) => ADDRESS.test(address ?? '')).map(([address, name]) => [address.toLowerCase(), name]))
export const LENDING = new Map([
  ['0xa238dd80c259a72e81d7e4664a9801593f98d1c5', 'Aave V3'],
  ['0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb', 'Morpho'],
])
export const APPS = new Map([...DEX, ...LENDING, [BRIDGE, 'Base Bridge'], [IDENTITY, 'ERC-8004'],
  ...[...B20_LAUNCHERS].map((address) => [address, 'BaseHub B20']),
  ['0xdc7ee816aeb2879a7b15bb7950638840f8695917', 'BaseHub'],
  ['0x8b31312a6cd06839efe768bd3d09be785b83574a', 'BaseHub'],
  ['0xe7c2fe007c65349c91b8ccac3c5be5a7f2fdaf21', 'PumpHub'],
])

const selectors = (signatures) => new Set(signatures.map(toFunctionSelector))
const events = (signatures) => new Set(signatures.map(toEventSelector))
export const TOKEN_CALLS = selectors(['transfer(address,uint256)', 'transferFrom(address,address,uint256)',
  'approve(address,uint256)', 'setApprovalForAll(address,bool)', 'safeTransferFrom(address,address,uint256)',
  'safeTransferFrom(address,address,uint256,bytes)', 'safeTransferFrom(address,address,uint256,uint256,bytes)',
  'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'])
export const X402_AUTH_CALLS = selectors([
  'transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)',
  'transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)',
])
export const AUTH_USED = toEventSelector('AuthorizationUsed(address,bytes32)')
export const SETTLEMENTS = events(['Settled()', 'SettledWithPermit()'])
export const SWAP_EVENTS = events([
  'Swap(address,uint256,uint256,uint256,uint256,address)',
  'Swap(address,address,uint256,uint256,uint256,uint256)',
  'Swap(address,address,int256,int256,uint160,uint128,int24)',
  'Swap(address,address,int256,int256,uint160,uint128,int24,uint128,uint128)',
])
export const SUPPLY_EVENTS = events([
  'Supply(address,address,address,uint256,uint16)',
  'Supply(bytes32,address,address,uint256,uint256)',
  'SupplyCollateral(bytes32,address,address,uint256)',
])
export const LENDING_EVENTS = new Set([...SUPPLY_EVENTS, ...events([
  'Borrow(address,address,address,uint256,uint8,uint256,uint16)',
  'Repay(address,address,address,uint256,bool)',
  'Withdraw(address,address,address,uint256)',
  'Borrow(bytes32,address,address,address,uint256,uint256)',
  'Repay(bytes32,address,address,uint256,uint256)',
  'Withdraw(bytes32,address,address,address,uint256,uint256)',
  'WithdrawCollateral(bytes32,address,address,address,uint256)',
])])
export const LP_EVENTS = events(['Mint(address,uint256,uint256)', 'Mint(address,address,uint256,uint256)', 'IncreaseLiquidity(uint256,uint128,uint256,uint256)'])
export const LP_MANAGERS = new Set([
  '0x03a520b32c04bf3beef7beb72e919cf822ed34f1', // Uniswap V3
])
export const BRIDGE_EVENTS = events(['ETHBridgeFinalized(address,address,uint256,bytes)', 'ERC20BridgeFinalized(address,address,address,address,uint256,bytes)'])
export const B20_CREATED = toEventSelector('B20Created(address,uint8,string,string,uint8,bytes)')
export const B20_LAUNCHED = toEventSelector('B20Launched(address,address,uint8,bytes32,bytes32,uint256)')
export const B20_CURVE_CREATED = toEventSelector('B20CurveCreated(address,address,bytes32,bytes32)')
export const AGENT_REGISTERED = toEventSelector('Registered(uint256,string,address)')
export const USER_OP_ABI = parseAbi(['event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)'])
export const USER_OP = toEventSelector(USER_OP_ABI[0])
export const B20_ABI = parseAbi(['function isB20Initialized(address token) view returns (bool)'])

let stockCache
export async function getStockRegistry(fetcher = fetch) {
  if (stockCache?.expires > Date.now()) return stockCache.result
  const stocks = new Map(STOCK_FALLBACK)
  let pageToken
  try {
    for (let page = 0; page < 4; page += 1) {
      const url = new URL('https://api.coinbase.com/v1/tokenized-stocks?page_size=500')
      if (pageToken) url.searchParams.set('page_token', pageToken)
      const response = await fetcher(url, { signal: AbortSignal.timeout(4000) })
      if (!response.ok) throw new Error('Stock registry unavailable')
      const body = await response.json()
      if (!Array.isArray(body.tokens) || body.tokens.length === 0) throw new Error('Empty stock registry')
      for (const token of body.tokens) {
        if (ADDRESS.test(token.contract_address) && typeof token.symbol === 'string') {
          stocks.set(token.contract_address.toLowerCase(), token.symbol.slice(0, 24))
        }
      }
      pageToken = body.next_page_token
      if (!pageToken) break
    }
    const result = { stocks, complete: !pageToken }
    stockCache = { result, expires: Date.now() + 60 * 60 * 1000 }
    return result
  } catch {
    return stockCache ? { ...stockCache.result, complete: false } : { stocks, complete: false }
  }
}
