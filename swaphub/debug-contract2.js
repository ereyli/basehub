import { createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

const CONTRACT_ABI = [{
  inputs: [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOutMinimum', type: 'uint256' },
    { name: 'sqrtPriceLimitX96', type: 'uint160' },
    { name: 'recipient', type: 'address' },
    { name: 'deadline', type: 'uint256' }
  ],
  name: 'exactInputSingle',
  outputs: [{ name: 'amountOut', type: 'uint256' }],
  stateMutability: 'payable',
  type: 'function'
}];

async function testSwap() {
  const CONTRACT = '0x3f70277ab3607b1aab0d1bcdf2a15970042ae103';
  const WETH = '0x4200000000000000000000000000000000000006';
  const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const amount = parseEther('0.0001');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const testAccount = '0x0000000000000000000000000000000000000001';
  
  console.log('Testing swap with call...');
  
  try {
    const result = await client.call({
      to: CONTRACT,
      data: client.encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'exactInputSingle',
        args: [
          WETH,
          USDC,
          3000,
          amount,
          BigInt(0),
          BigInt(0),
          testAccount,
          deadline
        ]
      }),
      value: amount,
      account: testAccount
    });
    
    console.log('✅ Call successful!');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Call failed:');
    console.error('Message:', error.shortMessage || error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    if (error.cause?.data) {
      console.error('Revert data:', error.cause.data);
    }
  }
}

testSwap();
