// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical, including the
// per-page `check` assertions.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  checkPluginTookEffect,
  checkSessionUrlRoundTrip,
  smokeExamplesSite,
} from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

const checks = {
  plugins: page => checkPluginTookEffect(page, 'JBrowsePluginUCSC'),
  'customizing-the-app': checkSessionUrlRoundTrip,
}

const failures = await smokeExamplesSite({
  distDir: path.join(here, '..', 'dist'),
  // single source of truth for the base path is astro.config.mjs
  base: config.base,
  slugs: examples.map(e => e.slug),
  // the web-worker example (a section on the customizing-the-app page) must
  // actually spawn an RPC worker — guards the Rollup circular-dependency TDZ
  // that webpack tolerates.
  workerSlug: 'customizing-the-app',
  check: (page, slug) => checks[slug]?.(page) ?? [],
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
