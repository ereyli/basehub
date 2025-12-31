import { createPublicClient, http, parseEther, formatUnits } from 'viem';
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
  
  console.log('Testing swap simulation...');
  console.log('Amount:', amount.toString());
  console.log('Contract:', CONTRACT);
  
  try {
    const result = await client.simulateContract({
      address: CONTRACT,
      abi: CONTRACT_ABI,
      functionName: 'exactInputSingle',
      args: [
        WETH,
        USDC,
        3000,
        amount,
        BigInt(0), // minOut
        BigInt(0),
        '0x049c97B55f2eF9523B50A61E66E8749F0c1F447C3a4e46944A0ED8b2EdD305ac',
        deadline
      ],
      value: amount,
      account: '0x049c97B55f2eF9523B50A61E66E8749F0c1F447C3a4e46944A0ED8b2EdD305ac'
    });
    
    console.log('✅ Simulation successful!');
    console.log('Result:', result.result.toString());
  } catch (error) {
    console.error('❌ Simulation failed:', error.shortMessage || error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

testSwap();
