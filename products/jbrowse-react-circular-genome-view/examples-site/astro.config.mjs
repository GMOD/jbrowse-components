import { fileURLToPath } from 'node:url'

import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/cgv',
  trailingSlash: 'always',
  integrations: [react()],
  // a key is matched under `base`, but a destination is written out as given
  redirects: {
    '/gene-density-marks': '/storybook/cgv/gene-density-ring/',
  },
  // ES output because the RPC worker code-splits; no HMR in dev because React
  // Fast Refresh breaks the worker. The linear site's config has the details.
  vite: {
    resolve: {
      alias: { '~site': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    worker: { format: 'es' },
    server: { hmr: false },
  },
})
