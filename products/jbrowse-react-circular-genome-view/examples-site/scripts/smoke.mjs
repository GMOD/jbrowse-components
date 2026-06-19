// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical.
import path from 'path'
import { fileURLToPath } from 'url'

import { smokeExamplesSite } from '@jbrowse/browser-test-utils'

import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

const failures = await smokeExamplesSite({
  distDir: path.join(here, '..', 'dist'),
  base: '/storybook/cgv',
  slugs: examples.map(e => e.slug),
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
