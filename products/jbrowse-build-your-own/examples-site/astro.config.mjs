import { fileURLToPath } from 'node:url'

import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

// The landing page quotes the measured chrome bundle sizes, and the file
// holding them is written by `pnpm measure-chrome-bundle` at the repo root,
// outside this project. Aliasing the root makes it a real build-time import
// (inlined into the HTML, no runtime fs) instead of a path this site's module
// resolution cannot see. Vite's fs allowlist has to be widened to match.
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/storybook/byo',
  trailingSlash: 'always',
  integrations: [react()],
  // See the sibling lgv examples-site config for why these two are set: ES
  // worker output because the RPC worker code-splits, and HMR off in dev to
  // dodge an upstream @vitejs/plugin-react Fast Refresh bug that breaks any
  // `?worker` import sharing the dev module graph.
  vite: {
    worker: { format: 'es' },
    server: { hmr: false, fs: { allow: [repoRoot] } },
    resolve: { alias: { '~repo': repoRoot } },
  },
})
