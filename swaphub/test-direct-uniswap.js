import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Uniswap V3 SwapRouter02 on Base
const SWAP_ROUTER_02 = '0x2626664c2603336E57B271c5C0b26F421741e481';
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// SwapRouter02 ABI for exactInputSingle
const ROUTER_ABI = [{
  inputs: [{
    components: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'recipient', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' }
    ],
    name: 'params',
    type: 'tuple'
  }],
  name: 'exactInputSingle',
  outputs: [{ name: 'amountOut', type: 'uint256' }],
  stateMutability: 'payable',
  type: 'function'
}];

const client = createPublicClient({
  chain: base,
  transport: http('https://base-mainnet.g.alchemy.com/v2/e_3LRKM0RipM2jfrPRn-CemN5EgByDgA')
});

async function simulateDirectSwap() {
  console.log('🔍 Testing DIRECT Uniswap SwapRouter02 call...');
  console.log('   Router:', SWAP_ROUTER_02);
  console.log('   WETH:', WETH);
  console.log('   USDC:', USDC);
  
  const testRecipient = '0x0000000000000000000000000000000000000001';
  const amount = parseEther('0.001');
  
  try {
    const result = await client.simulateContract({
      address: SWAP_ROUTER_02,
      abi: ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 3000,
        recipient: testRecipient,
        amountIn: amount,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0)
      }],
      value: amount,
      account: testRecipient
    });
    
    console.log('✅ Direct Uniswap simulation SUCCESS!');
    console.log('   Expected output:', result.result?.toString());
  } catch (error) {
    console.error('❌ Direct Uniswap simulation FAILED:');
    console.error('   Error:', error.shortMessage || error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
  }
}

simulateDirectSwap();
