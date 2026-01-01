import '@rainbow-me/rainbowkit/styles.css';
import SwapInterface from './components/SwapInterface';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';

const config = getDefaultConfig({
  appName: 'UniMini DEX',
  projectId: '2c9f2a3e8b5d4c1a9e8f7b6c5d4e3f2a',
  chains: [base],
  transports: {
    [base.id]: http('https://base-mainnet.g.alchemy.com/v2/e_3LRKM0RipM2jfrPRn-CemN5EgByDgA', {
      timeout: 30000, // 30 seconds timeout
      retryCount: 3,
      retryDelay: 1000
    })
  },
  ssr: false,
});

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#000000',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <main style={{ flex: 1 }}>
              <SwapInterface />
            </main>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

