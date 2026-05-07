import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import icon from 'astro-icon'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/jb2',
  publicDir: './static',
  trailingSlash: 'always',
  integrations: [react(), icon()],
})
