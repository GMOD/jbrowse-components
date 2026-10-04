import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/cgv',
  trailingSlash: 'always',
  integrations: [react()],
  // ES output because the RPC worker code-splits; no HMR in dev because React
  // Fast Refresh breaks the worker. The linear site's config has the details.
  vite: {
    worker: { format: 'es' },
    server: { hmr: false },
  },
})
