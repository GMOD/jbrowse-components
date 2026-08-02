import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/byo',
  trailingSlash: 'always',
  integrations: [react()],
  // See the sibling lgv examples-site config for why these two are set: ES
  // worker output because the RPC worker code-splits, and HMR off in dev to
  // dodge an upstream @vitejs/plugin-react Fast Refresh bug that breaks any
  // `?worker` import sharing the dev module graph.
  vite: {
    worker: { format: 'es' },
    server: { hmr: false },
  },
})
