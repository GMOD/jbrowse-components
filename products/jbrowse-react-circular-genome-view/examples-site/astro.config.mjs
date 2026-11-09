import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

import { examplesSiteConfig } from '../../examples-site-shared/astroConfig.mjs'

export default defineConfig(
  examplesSiteConfig(import.meta.url, {
    base: '/storybook/cgv',
    integrations: [react()],
    redirects: {
      'gene-density-marks': 'gene-density-ring',
      'web-worker': 'volvox',
    },
  }),
)
