import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbiParameters,
  parseUnits,
  stringToBytes,
} from 'viem'
import { NETWORKS, CONTRACT_ADDRESSES, getNetworkConfigKey } from './networks'

export const B20_FACTORY_ADDRESS = '0xB20f000000000000000000000000000000000000'
export const B20_ACTIVATION_REGISTRY_ADDRESS = '0x8453000000000000000000000000000000000001'
export const B20_FEE_WALLET = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
export const B20_DEPLOY_FEE_ETH = '0.0008'
export const B20_XP_REWARD = 2000
export const B20_XP_GAME_TYPE = 'B20 Deployment'

export const B20_VARIANTS = {
  ASSET: 0,
  STABLECOIN: 1,
}

export const B20_FEATURES = {
  [B20_VARIANTS.ASSET]: 'base.b20_asset',
  [B20_VARIANTS.STABLECOIN]: 'base.b20_stablecoin',
}

export const B20_FEATURE_IDS = {
  [B20_VARIANTS.ASSET]: keccak256(stringToBytes(B20_FEATURES[B20_VARIANTS.ASSET])),
  [B20_VARIANTS.STABLECOIN]: keccak256(stringToBytes(B20_FEATURES[B20_VARIANTS.STABLECOIN])),
}

export const B20_ROLES = {
  MINT_ROLE: keccak256(stringToBytes('MINT_ROLE')),
  METADATA_ROLE: keccak256(stringToBytes('METADATA_ROLE')),
  OPERATOR_ROLE: keccak256(stringToBytes('OPERATOR_ROLE')),
}

export const B20_MAX_SUPPLY_CAP = (2n ** 128n) - 1n

export const B20_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createB20',
    stateMutability: 'payable',
    inputs: [
      { name: 'variant', type: 'uint8' },
      { name: 'salt', type: 'bytes32' },
      { name: 'params', type: 'bytes' },
      { name: 'initCalls', type: 'bytes[]' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getB20Address',
    stateMutability: 'view',
    inputs: [
      { name: 'variant', type: 'uint8' },
      { name: 'sender', type: 'address' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'event',
    name: 'B20Created',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'variant', type: 'uint8', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'decimals', type: 'uint8', indexed: false },
      { name: 'variantEventParams', type: 'bytes', indexed: false },
    ],
  },
]

export const B20_ACTIVATION_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'isActivated',
    stateMutability: 'view',
    inputs: [{ name: 'feature', type: 'bytes32' }],
    outputs: [{ name: 'active', type: 'bool' }],
  },
]

export const B20_TOKEN_INIT_ABI = [
  {
    type: 'function',
    name: 'grantRole',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateSupplyCap',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newSupplyCap', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'batchMint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
]

export const BASEHUB_B20_LAUNCHER_ABI = [
  {
    type: 'function',
    name: 'createB20',
    stateMutability: 'payable',
    inputs: [
      { name: 'variant', type: 'uint8' },
      { name: 'userSalt', type: 'bytes32' },
      { name: 'params', type: 'bytes' },
      { name: 'initCalls', type: 'bytes[]' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getB20Address',
    stateMutability: 'view',
    inputs: [
      { name: 'variant', type: 'uint8' },
      { name: 'user', type: 'address' },
      { name: 'userSalt', type: 'bytes32' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'event',
    name: 'B20Launched',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'variant', type: 'uint8', indexed: true },
      { name: 'userSalt', type: 'bytes32', indexed: false },
      { name: 'factorySalt', type: 'bytes32', indexed: false },
      { name: 'feePaid', type: 'uint256', indexed: false },
    ],
  },
]

export function isB20SupportedChainId(chainId) {
  return Number(chainId) === NETWORKS.BASE.chainId
}

export function isB20TestnetChainId(chainId) {
  return false
}

export function getB20LauncherAddress(chainId) {
  if (chainId == null) return null
  const key = getNetworkConfigKey(chainId)
  const raw = CONTRACT_ADDRESSES[key]?.BASEHUB_B20_LAUNCHER
  return raw && /^0x[a-fA-F0-9]{40}$/.test(String(raw)) ? String(raw) : null
}

export function encodeB20CreateParams({ variant, name, symbol, admin, decimals, currency }) {
  if (variant === B20_VARIANTS.STABLECOIN) {
    return encodeAbiParameters(
      parseAbiParameters('uint8 version, string name, string symbol, address initialAdmin, string currency'),
      [1, name, symbol, admin, currency]
    )
  }

  return encodeAbiParameters(
    parseAbiParameters('uint8 version, string name, string symbol, address initialAdmin, uint8 decimals'),
    [1, name, symbol, admin, decimals]
  )
}

export function buildB20InitCalls({ variant, admin, decimals, initialMint, supplyCap }) {
  const calls = [
    encodeFunctionData({ abi: B20_TOKEN_INIT_ABI, functionName: 'grantRole', args: [B20_ROLES.MINT_ROLE, admin] }),
    encodeFunctionData({ abi: B20_TOKEN_INIT_ABI, functionName: 'grantRole', args: [B20_ROLES.METADATA_ROLE, admin] }),
  ]

  if (variant === B20_VARIANTS.ASSET) {
    calls.push(
      encodeFunctionData({ abi: B20_TOKEN_INIT_ABI, functionName: 'grantRole', args: [B20_ROLES.OPERATOR_ROLE, admin] })
    )

    const cap = supplyCap ? parseUnits(String(supplyCap), decimals) : B20_MAX_SUPPLY_CAP
    calls.push(
      encodeFunctionData({ abi: B20_TOKEN_INIT_ABI, functionName: 'updateSupplyCap', args: [cap] })
    )

    if (initialMint && Number(initialMint) > 0) {
      const amount = parseUnits(String(initialMint), decimals)
      calls.push(
        encodeFunctionData({
          abi: B20_TOKEN_INIT_ABI,
          functionName: 'batchMint',
          args: [[admin], [amount]],
        })
      )
    }
  }

  return calls
}
