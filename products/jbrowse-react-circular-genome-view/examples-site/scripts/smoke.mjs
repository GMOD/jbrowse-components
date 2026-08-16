// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical, including the
// per-page `check` assertions.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  checkDemoAboveFold,
  checkDemoHeights,
  checkSessionUrlRoundTrip,
  checkTextContrast,
  checkTrackIsShown,
  smokeExamplesSite,
} from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

const checks = {
  'session-in-url': checkSessionUrlRoundTrip,
  'show-track': checkTrackIsShown,
}

const failures = await smokeExamplesSite({
  distDir: path.join(here, '..', 'dist'),
  // single source of truth for the base path is astro.config.mjs
  base: config.base,
  slugs: examples.filter(e => !e.skipSmoke).map(e => e.slug),
  check: async (page, slug) => [
    ...(await checkDemoHeights(page)),
    ...(await checkDemoAboveFold(page)),
    // before the per-slug checks below, which click and reload
    ...(await checkTextContrast(page)),
    ...(await (checks[slug]?.(page) ?? [])),
  ],
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
