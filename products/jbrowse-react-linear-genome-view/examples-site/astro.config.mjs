import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

import { examplesSiteConfig } from '../../examples-site-shared/astroConfig.mjs'

export default defineConfig(
  examplesSiteConfig(import.meta.url, {
    base: '/storybook/lgv',
    integrations: [react()],
    redirects: {
      'external-navigate': 'view-controls',
      'text-search': 'search-by-name',
      'error-handler': 'session-persistence',
      'outside-styling': 'custom-theme',
      'view-prop': 'one-linear-genome-view',
      'use-create-view-state': 'show-track',
      'drawer-widget': 'fixed-height',
      'view-spelled-out': 'highlight-regions',
      'aggregate-text-search': 'search-by-name',
      'per-track-text-search': 'search-by-name',
      'observe-visible': 'observe-session',
      'observe-selection': 'observe-session',
      'alignments-display': 'group-by-tag',
      'web-worker': 'one-linear-genome-view',
    },
  }),
)
