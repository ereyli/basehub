import { NETWORKS, getContractAddressByNetwork } from './networks'

export const ERC8004_AGENT_XP_REWARD = 5000

export const ERC8004_IDENTITY_REGISTRY = {
  [NETWORKS.BASE.chainId]: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
}

export const ERC8004_REGISTRAR_DEPLOY_BLOCK = {
  [NETWORKS.BASE.chainId]: 47670327n,
}

export const BASEHUB_ERC8004_REGISTRAR_ABI = [
  {
    inputs: [{ internalType: 'string', name: 'agentURI', type: 'string' }],
    name: 'registerAgent',
    outputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeWei',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'agentURI', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'feePaid', type: 'uint256' },
    ],
    name: 'AgentRegistered',
    type: 'event',
  },
]

export const ERC8004_IDENTITY_REGISTRY_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'string', name: 'newURI', type: 'string' },
    ],
    name: 'setAgentURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export function getERC8004IdentityRegistry(chainId) {
  return ERC8004_IDENTITY_REGISTRY[Number(chainId)] || null
}

export function getERC8004RegistrarAddress(chainId) {
  const configured = getContractAddressByNetwork('BASEHUB_ERC8004_REGISTRAR', chainId)
  return configured && /^0x[a-fA-F0-9]{40}$/.test(configured) ? configured : null
}
