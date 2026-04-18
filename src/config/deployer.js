import { toFunctionSelector, concat, padHex, toHex } from 'viem'

/**
 * Encode deployer call manually to avoid viem's bytes size limit (8384) when passing
 * large initCode (ERC721/ERC1155). Use this + sendTransaction instead of writeContractAsync.
 */
export function encodeDeployerCall(functionName, initCodeHex) {
  const hex = initCodeHex.startsWith('0x') ? initCodeHex : '0x' + initCodeHex
  const byteLength = (hex.length - 2) / 2
  const paddedBytes = Math.ceil(byteLength / 32) * 32
  const selector = toFunctionSelector(`${functionName}(bytes)`)
  return concat([
    selector,
    padHex(toHex(32n), { size: 32 }),
    padHex(toHex(BigInt(byteLength)), { size: 32 }),
    padHex(hex, { size: paddedBytes, dir: 'right' }),
  ])
}

// BaseHubDeployer contract ABI (deployERC20, deployERC721, deployERC1155 + Deployed event)
export const BASEHUB_DEPLOYER_ABI = [
  {
    inputs: [{ internalType: 'bytes', name: 'initCode', type: 'bytes' }],
    name: 'deployERC20',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'initCode', type: 'bytes' }],
    name: 'deployERC721',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'initCode', type: 'bytes' }],
    name: 'deployERC1155',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'initCode', type: 'bytes' }],
    name: 'deployNFTCollection',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'deployedAddress', type: 'address' },
      { indexed: false, internalType: 'uint8', name: 'tokenType', type: 'uint8' },
    ],
    name: 'Deployed',
    type: 'event',
  },
]

/** TempoTokenFactory — `deployToken(name, symbol, initialSupply, decimals)` + PUSD fee (see `contracts/tempo/TempoTokenFactory.sol`). */
export const TEMPO_TOKEN_FACTORY_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'initialSupply', type: 'uint256' },
      { internalType: 'uint8', name: 'decimals', type: 'uint8' },
    ],
    name: 'deployToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'deployFeeUsd6',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeToken',
    outputs: [{ internalType: 'contract IFeeToken', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      { indexed: false, internalType: 'string', name: 'symbol', type: 'string' },
    ],
    name: 'TokenDeployed',
    type: 'event',
  },
]

export const DEPLOYER_FEE_ETH = '0.00025'
/** NFT Launchpad: non–Early Access Pass holders */
export const DEPLOYER_FEE_NFT_COLLECTION_ETH = '0.002'
/** NFT Launchpad: BaseHub Early Access Pass holders */
export const DEPLOYER_FEE_NFT_COLLECTION_ETH_HOLDER = '0.0005'
