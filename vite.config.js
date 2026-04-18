import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Vite does not run /api/* (Vercel serverless). Proxy to a host that serves them.
// Default: production. Override with DEV_API_PROXY=http://127.0.0.1:3000 when using `vercel dev` on 3000 (run Vite on another port, e.g. VITE_PORT=5173).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const raw =
    env.DEV_API_PROXY ||
    env.VITE_DEV_API_PROXY ||
    (env.VITE_API_URL && env.VITE_API_URL.replace(/\/$/, '')) ||
    'https://www.basehub.fun'

  // Avoid apex→www redirects: if the proxy gets a 302 to another host, the browser follows it and hits CORS from localhost.
  const apiTarget = raw.replace(/^https?:\/\/basehub\.fun/i, 'https://www.basehub.fun')

  return {
  plugins: [react()],
  server: {
    // Default 5173 (Vite convention). Use 3000 only if you set VITE_PORT=3000 — avoids clashing with `vercel dev` on :3000.
    port: Number(env.VITE_PORT) || 5173,
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000, // Increase limit to 1000 KB (1 MB)
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-wagmi': ['wagmi', 'viem', '@tanstack/react-query'],
          'vendor-web3': ['ethers', '@rainbow-me/rainbowkit'],
          'vendor-farcaster': ['@farcaster/miniapp-sdk', '@farcaster/miniapp-wagmi-connector'],
          'vendor-x402': ['x402-fetch', 'x402-hono', '@coinbase/x402'],
        },
      },
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer']
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  }
})
