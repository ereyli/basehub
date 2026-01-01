import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

const QUOTER_ABI = [{
  inputs: [{
    components: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' }
    ],
    name: 'params',
    type: 'tuple'
  }],
  name: 'quoteExactInputSingle',
  outputs: [
    { name: 'amountOut', type: 'uint256' },
    { name: 'sqrtPriceX96After', type: 'uint160' },
    { name: 'initializedTicksCrossed', type: 'uint32' },
    { name: 'gasEstimate', type: 'uint256' }
  ],
  stateMutability: 'nonpayable',
  type: 'function'
}];

async function testQuote() {
  try {
    const result = await client.simulateContract({
      address: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [{
        tokenIn: '0x4200000000000000000000000000000000000006', // WETH
        tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        amountIn: BigInt('1000000000000000'), // 0.001 ETH
        fee: 3000,
        sqrtPriceLimitX96: BigInt(0)
      }]
    });
    
    console.log('Quote successful:', result.result[0].toString());
  } catch (error) {
    console.error('Quote failed:', error.message);
  }
}

testQuote();
