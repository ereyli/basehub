import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function localApiPlugin() {
  const routes = {
    '/api/erc8004-agents': './api/erc8004-agents.js',
    '/api/erc8004-agent-views': './api/erc8004-agent-views.js',
  }

  return {
    name: 'basehub-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : ''
        const route = routes[pathname]
        if (!route) return next()

        try {
          let rawBody = ''
          req.setEncoding('utf8')
          for await (const chunk of req) rawBody += chunk
          let parsedBody = {}
          if (rawBody) {
            try {
              parsedBody = JSON.parse(rawBody)
            } catch {
              parsedBody = rawBody
            }
          }

          const mod = await import(`${route}?t=${Date.now()}`)
          const handlerReq = {
            ...req,
            body: parsedBody,
            url: req.url,
            method: req.method,
            headers: req.headers,
          }
          const handlerRes = {
            statusCode: 200,
            headers: {},
            setHeader(key, value) {
              this.headers[key] = value
              res.setHeader(key, value)
            },
            status(code) {
              this.statusCode = code
              res.statusCode = code
              return this
            },
            json(payload) {
              if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
              res.statusCode = this.statusCode
              res.end(JSON.stringify(payload))
            },
            end(payload = '') {
              res.statusCode = this.statusCode
              res.end(payload)
            },
          }

          await mod.default(handlerReq, handlerRes)
        } catch (err) {
          console.error('local api error:', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Local API failed', detail: err?.message || String(err) }))
        }
      })
    },
  }
}

// Vite does not run /api/* (Vercel serverless). Proxy to a host that serves them.
// Default: production. Override with DEV_API_PROXY=http://127.0.0.1:3000 when using `vercel dev` on 3000 (run Vite on another port, e.g. VITE_PORT=5173).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.entries(env).forEach(([key, value]) => {
    if (process.env[key] == null) process.env[key] = value
  })
  const raw =
    process.env.DEV_API_PROXY ||
    process.env.VITE_DEV_API_PROXY ||
    process.env.VITE_API_URL?.replace(/\/$/, '') ||
    env.DEV_API_PROXY ||
    env.VITE_DEV_API_PROXY ||
    (env.VITE_API_URL && env.VITE_API_URL.replace(/\/$/, '')) ||
    'https://www.basehub.fun'

  // Avoid apex→www redirects: if the proxy gets a 302 to another host, the browser follows it and hits CORS from localhost.
  const apiTarget = raw.replace(/^https?:\/\/basehub\.fun/i, 'https://www.basehub.fun')

  return {
  plugins: [react(), localApiPlugin()],
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
          'vendor-x402': ['@x402/fetch', '@x402/hono', '@x402/evm', '@x402/extensions', '@coinbase/x402'],
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
