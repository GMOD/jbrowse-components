import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

import { examplesSiteConfig } from '../../examples-site-shared/astroConfig.mjs'
import { eagerGraphDump } from './scripts/eagerGraphDump.mjs'

export default defineConfig(
  examplesSiteConfig(import.meta.url, {
    base: '/storybook/byo',
    integrations: [react()],
    redirects: { 'highlight-a-region': 'table-of-calls' },
    plugins: [eagerGraphDump()],
  }),
)
