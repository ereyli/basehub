// x402 Payment Endpoint for BaseHub
// Accepts 0.1 USDC payments using Coinbase x402
// Reference: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers

export default async function handler(req, res) {
  // Set CORS headers first - before any response
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-PAYMENT');
  res.setHeader('Access-Control-Expose-Headers', 'X-PAYMENT-RESPONSE');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Your receiving wallet address (update this with your actual mainnet wallet)
  const RECEIVING_ADDRESS = process.env.X402_RECEIVING_ADDRESS || '0x0000000000000000000000000000000000000000';

  // Payment configuration
  const PRICE = '$0.1'; // 0.1 USDC
  const NETWORK = process.env.X402_NETWORK || 'base'; // 'base' for mainnet, 'base-sepolia' for testnet

  // Health check endpoint
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      network: NETWORK,
      price: PRICE,
      recipient: RECEIVING_ADDRESS,
      facilitator: process.env.CDP_API_KEY_ID ? 'CDP' : 'Testnet',
    });
  }

  // Only allow POST for payment
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for payment header
  const paymentHeader = req.headers['x-payment'];
  
  if (!paymentHeader) {
    // No payment - return 402 Payment Required with payment instructions
    const facilitatorUrl = process.env.CDP_API_KEY_ID 
      ? 'CDP Facilitator' // Will use CDP facilitator
      : 'https://x402.org/facilitator'; // Testnet facilitator
    
    return res.status(402).json({
      x402Version: '1',
      accepts: [
        {
          network: NETWORK,
          amount: '0.1',
          currency: 'USDC',
          recipient: RECEIVING_ADDRESS,
          facilitator: facilitatorUrl,
        }
      ],
      error: 'Payment Required',
      message: 'Include X-PAYMENT header with payment proof to access this endpoint',
    });
  }

  // Verify payment
  try {
    // Parse payment proof
    let paymentProof;
    try {
      paymentProof = typeof paymentHeader === 'string' 
        ? JSON.parse(paymentHeader) 
        : paymentHeader;
    } catch (parseError) {
      return res.status(400).json({
        error: 'Invalid Payment Header',
        message: 'X-PAYMENT header must be valid JSON',
      });
    }

    // Setup facilitator verification
    let verifyUrl;
    let verifyHeaders = {
      'Content-Type': 'application/json',
    };

    if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
      // Use CDP facilitator for mainnet
      const { createCdpAuthHeaders } = await import('@coinbase/x402');
      const authHeaders = createCdpAuthHeaders(
        process.env.CDP_API_KEY_ID,
        process.env.CDP_API_KEY_SECRET
      );
      
      // CDP facilitator uses different endpoint
      verifyUrl = 'https://api.cdp.coinbase.com/x402/verify';
      const authHeader = await authHeaders('POST', 'api.cdp.coinbase.com', '/x402/verify');
      verifyHeaders = {
        ...verifyHeaders,
        ...authHeader,
      };
    } else {
      // Use testnet facilitator
      verifyUrl = 'https://x402.org/facilitator/verify';
    }

    // Verify payment with facilitator
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: verifyHeaders,
      body: JSON.stringify({
        payment: paymentProof,
        amount: PRICE,
        network: NETWORK,
        recipient: RECEIVING_ADDRESS,
      }),
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      return res.status(402).json({
        error: 'Payment Verification Failed',
        message: errorData.message || 'Could not verify payment',
      });
    }

    const verificationResult = await verifyResponse.json();

    if (!verificationResult.valid) {
      return res.status(402).json({
        error: 'Invalid Payment',
        message: verificationResult.reason || 'Payment verification failed',
      });
    }

    // Payment verified successfully!
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully!',
      payment: {
        amount: PRICE,
        currency: 'USDC',
        network: NETWORK,
        recipient: RECEIVING_ADDRESS,
        transactionHash: verificationResult.txHash,
      },
      timestamp: new Date().toISOString(),
      data: {
        paymentCompleted: true,
      },
    });

  } catch (error) {
    console.error('x402 Payment verification error:', error);
    
    // If response already sent, don't send again
    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Payment verification failed',
    });
  }
}
