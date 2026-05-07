import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import icon from 'astro-icon'
import { resolve } from 'node:path'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/jb2',
  trailingSlash: 'always',
  vite: {
    resolve: {
      alias: {
        '@docusaurus/useBaseUrl': resolve('./src/shims/docusaurus-use-base-url.js'),
      },
    },
  },
  integrations: [react(), icon()],
})
