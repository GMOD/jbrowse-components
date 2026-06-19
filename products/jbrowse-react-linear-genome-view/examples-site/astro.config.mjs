import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/lgv',
  trailingSlash: 'always',
  integrations: [react()],
  // The RPC worker (imported via Vite's `?worker`) needs ES output because it
  // code-splits. NOTE: under Rollup's strict ESM the JBrowse worker graph hits
  // a circular-dependency init-order error ("Cannot access TextSearchManager
  // before initialization") that webpack's CJS interop tolerates — see the
  // WithWebWorker example note.
  vite: {
    worker: { format: 'es' },
  },
})
