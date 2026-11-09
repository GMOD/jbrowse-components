import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

import { examplesSiteConfig } from '../../examples-site-shared/astroConfig.mjs'

export default defineConfig(
  examplesSiteConfig(import.meta.url, {
    base: '/storybook/app',
    integrations: [react()],
    redirects: {
      'add-tracks-programmatically': 'launch-view',
      'import-config-json': 'fetch-config-json',
      dotplot: 'linear-synteny',
    },
  }),
)
