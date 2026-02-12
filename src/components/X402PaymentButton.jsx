import React, { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { wrapFetchWithPayment } from 'x402-fetch';
import { getX402ApiBase } from '../config/x402';

const X402PaymentButton = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  const handlePayment = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!walletClient) {
      setError('Wallet client not available. Please make sure your wallet is unlocked and connected.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setPaymentData(null);

    try {
      // Wait a bit to ensure wallet is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      // Wrap fetch with x402 payment handling
      // wrapFetchWithPayment automatically handles:
      // 1. Initial request
      // 2. 402 Payment Required response
      // 3. Payment creation with wallet
      // 4. Retry with X-PAYMENT header
      
      const apiBase = getX402ApiBase();
      const fetchWithPayment = wrapFetchWithPayment(
        fetch,
        walletClient,
        BigInt(100000), // 0.1 USDC in base units (6 decimals: 0.1 * 10^6)
      );

      const response = await fetchWithPayment(`${apiBase}/api/x402-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Payment failed');
      }

      const result = await response.json();
      setPaymentData(result);
      setSuccess(true);
      console.log('Payment successful:', result);

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '24px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '16px',
      maxWidth: '400px',
      margin: '0 auto',
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: 'white',
        margin: 0,
      }}>
        BaseHub Premium
      </h2>
      
      <p style={{
        fontSize: '16px',
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        margin: 0,
      }}>
        Unlock premium features with 0.1 USDC
      </p>

      <button
        onClick={handlePayment}
        disabled={loading || !isConnected || !walletClient}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: '600',
          color: 'white',
          background: isConnected && walletClient && !loading 
            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            : 'rgba(255, 255, 255, 0.3)',
          border: 'none',
          borderRadius: '12px',
          cursor: isConnected && walletClient && !loading ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s ease',
          boxShadow: isConnected && walletClient && !loading 
            ? '0 4px 12px rgba(245, 158, 11, 0.4)'
            : 'none',
          minWidth: '200px',
        }}
      >
        {loading ? 'Processing Payment...' : !isConnected ? 'Connect Wallet' : !walletClient ? 'Unlock Wallet' : 'Pay 0.1 USDC'}
      </button>

      {error && (
        <div style={{
          padding: '12px',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          textAlign: 'center',
          maxWidth: '100%',
        }}>
          {error}
        </div>
      )}

      {success && paymentData && (
        <div style={{
          padding: '16px',
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid rgba(16, 185, 129, 0.5)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          textAlign: 'center',
          maxWidth: '100%',
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>
            ✅ Payment Successful!
          </p>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
            Transaction: {paymentData.payment?.transactionHash?.slice(0, 10)}...
          </p>
          {paymentData.data?.features && (
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', textAlign: 'left' }}>
              {paymentData.data.features.map((feature, index) => (
                <li key={index} style={{ fontSize: '12px', margin: '4px 0' }}>
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isConnected && (
        <p style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          margin: 0,
        }}>
          Connect your wallet to make a payment
        </p>
      )}

      {isConnected && !walletClient && (
        <p style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          margin: '8px 0 0 0',
        }}>
          Please unlock your wallet to proceed
        </p>
      )}
    </div>
  );
};

export default X402PaymentButton;

