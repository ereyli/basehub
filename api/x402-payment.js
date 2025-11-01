// x402 Payment Endpoint for BaseHub
// Accepts 0.1 USDC payments using Coinbase x402
// Reference: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers

import express from 'express';
import { paymentMiddleware } from 'x402-express';
import { facilitator } from '@coinbase/x402';

const app = express();
app.use(express.json());

// Your receiving wallet address (update this with your actual mainnet wallet)
const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x0000000000000000000000000000000000000000';

// Payment configuration
const PRICE = '$0.1'; // 0.1 USDC
const NETWORK = process.env.X402_NETWORK || 'base'; // 'base' for mainnet, 'base-sepolia' for testnet

// Configure facilitator
let facilitatorConfig;
if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
  // Use CDP facilitator for mainnet
  facilitatorConfig = facilitator({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  });
} else {
  // Use testnet facilitator
  facilitatorConfig = { url: 'https://x402.org/facilitator' };
}

// Apply payment middleware
app.use(
  paymentMiddleware(
    RECEIVING_ADDRESS,
    {
      'POST /': {
        price: PRICE,
        network: NETWORK,
        config: {
          description: 'BaseHub x402 Payment - Pay 0.1 USDC',
          mimeType: 'application/json',
        },
      },
    },
    facilitatorConfig
  )
);

// Payment endpoint handler
app.post('/', (req, res) => {
  // If we reach here, payment has been verified by middleware
  res.json({
    success: true,
    message: 'Payment verified successfully!',
    payment: {
      amount: PRICE,
      currency: 'USDC',
      network: NETWORK,
      recipient: RECEIVING_ADDRESS,
    },
    timestamp: new Date().toISOString(),
    data: {
      paymentCompleted: true,
    },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    network: NETWORK,
    price: PRICE,
    recipient: RECEIVING_ADDRESS,
    facilitator: process.env.CDP_API_KEY_ID ? 'CDP' : 'Testnet',
  });
});

// Export for Vercel (Express app)
export default app;
