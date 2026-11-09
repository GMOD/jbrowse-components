import { fileURLToPath } from 'node:url'

import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

import { eagerGraphDump } from './scripts/eagerGraphDump.mjs'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/byo',
  trailingSlash: 'always',
  // a key is relative to `base`, a destination is not: one naming a page's
  // route would redirect to that route without the base
  redirects: {
    '/highlight-a-region': '/storybook/byo/table-of-calls/',
  },
  integrations: [react()],
  // See the sibling lgv examples-site config for why these two are set: ES
  // worker output because the RPC worker code-splits, and HMR off in dev to
  // dodge an upstream @vitejs/plugin-react Fast Refresh bug that breaks any
  // `?worker` import sharing the dev module graph.
  vite: {
    resolve: {
      alias: { '~site': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    worker: { format: 'es' },
    server: { hmr: false },
    plugins: [eagerGraphDump()],
  },
})
