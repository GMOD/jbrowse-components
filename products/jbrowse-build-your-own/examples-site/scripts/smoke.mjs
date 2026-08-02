// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical.
import path from 'path'
import { fileURLToPath } from 'url'

import { smokeExamplesSite } from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

const failures = await smokeExamplesSite({
  distDir: path.join(here, '..', 'dist'),
  // single source of truth for the base path is astro.config.mjs
  base: config.base,
  slugs: examples.filter(e => !e.skipSmoke).map(e => e.slug),
  // no workerSlug: every demo here runs main-thread RPC, so there is no worker
  // spawn to guard
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
