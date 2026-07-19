import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/lgv',
  trailingSlash: 'always',
  integrations: [react()],
  // The RPC worker (imported via Vite's `?worker`) needs ES output because it
  // code-splits.
  //
  // We disable HMR in dev ONLY to turn off React Fast Refresh, working around
  // an upstream @vitejs/plugin-react bug: our RPC worker (imported via
  // `?worker`) shares the dev module graph with the main thread and imports
  // Fast-Refresh-instrumented modules. Those modules pull in `/@react-refresh`,
  // whose runtime touches `window` at eval time, and reference the page
  // preamble's `window.$RefreshSig$` — neither exists in a worker, so it throws
  // (`ReferenceError: window is not defined` / `$RefreshSig$ is not defined`).
  // `server.hmr:false` is plugin-react's only dev lever for skipping Fast
  // Refresh. Production builds already strip it, so this affects dev only.
  // Remove once plugin-react makes its refresh runtime worker-safe
  // (window -> globalThis).
  vite: {
    worker: { format: 'es' },
    server: { hmr: false },
  },
})
