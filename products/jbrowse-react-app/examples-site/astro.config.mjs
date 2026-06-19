import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/app',
  trailingSlash: 'always',
  integrations: [react()],
})
