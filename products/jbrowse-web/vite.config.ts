import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    {
      name: 'no-gzip-content-encoding',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.gz') || req.url?.endsWith('.bgz')) {
            const originalSetHeader = res.setHeader.bind(res)
            res.setHeader = (name, value) => {
              if (name.toLowerCase() === 'content-encoding') {
                return res
              }
              return originalSetHeader(name, value)
            }
          }
          next()
        })
      },
    },
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development',
    ),
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
  },
  worker: {
    format: 'iife',
    plugins: () => [
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
        fastRefresh: false,
      }),
    ],
  },
  resolve: {
    conditions: ['mui-modern'],
    alias: {
      'fs/promises': new URL('src/empty.ts', import.meta.url).pathname,
      fs: new URL('src/empty.ts', import.meta.url).pathname,
    },
  },
})
