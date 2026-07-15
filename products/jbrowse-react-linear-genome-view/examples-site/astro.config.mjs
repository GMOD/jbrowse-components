import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/lgv',
  trailingSlash: 'always',
  integrations: [react()],
  // The RPC worker (imported via Vite's `?worker`) needs ES output because it
  // code-splits.
  vite: {
    worker: { format: 'es' },
  },
})
