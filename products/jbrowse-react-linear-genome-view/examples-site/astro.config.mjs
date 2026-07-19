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
  // server.hmr:false disables React Fast Refresh in dev. The worker shares the
  // dev module graph with the main thread, and Fast Refresh injects
  // `$RefreshSig$`/`$RefreshReg$` calls plus a `/@react-refresh` import that
  // rely on the page preamble (`window`), which does not exist in a worker
  // (`ReferenceError: $RefreshSig$ is not defined`). Production builds already
  // strip Fast Refresh, so this only affects dev.
  vite: {
    worker: { format: 'es' },
    server: { hmr: false },
  },
})
