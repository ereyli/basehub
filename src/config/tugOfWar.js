export const TUG_OF_WAR_ADDRESS = '0x6102f5893EF6cDE8Eabf67f59845D7704b228a2c'

export const TUG_OF_WAR_ABI = [
  {
    type: 'function',
    name: 'createMarket',
    stateMutability: 'payable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'endTime', type: 'uint256' },
    ],
    outputs: [{ name: 'marketId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'bet',
    stateMutability: 'payable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'forYes', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'resolve',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [{ name: 'payout', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'marketCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createFeeEth',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'platformFeeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'maxBetPerUser',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lockWindowSeconds',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getMarket',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      {
        components: [
          { name: 'question', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'endTime', type: 'uint64' },
          { name: 'totalYes', type: 'uint256' },
          { name: 'totalNo', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'winningSide', type: 'uint8' },
          { name: 'feeAmount', type: 'uint256' },
          { name: 'distributablePool', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
  },
  {
    type: 'function',
    name: 'getUserStakes',
    stateMutability: 'view',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'yesStake', type: 'uint256' },
      { name: 'noStake', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getClaimable',
    stateMutability: 'view',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isBetLocked',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getMarketImbalance',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      { name: 'yesTotal', type: 'uint256' },
      { name: 'noTotal', type: 'uint256' },
      { name: 'imbalanceBps', type: 'uint256' },
      { name: 'isWarning', type: 'bool' },
    ],
  },
]
