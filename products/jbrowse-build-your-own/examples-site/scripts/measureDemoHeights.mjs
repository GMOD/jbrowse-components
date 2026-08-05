// Write the height each demo settles at, which src/siteMeta.ts reserves on its
// box so the page doesn't jump when the island mounts:
//
//   pnpm build && pnpm measure-demo-heights && pnpm build
//
// Twice, because unlike the other two measured artifacts here this one is an
// *input* to the build: the first pass gives it something to measure, the second
// ships the result. Measuring neutralises each box's current reservation, so a
// stale number in the tree cannot influence the new one.
//
// There is no `--check` half. `pnpm smoke` already re-measures every demo against
// the reservation the page actually shipped, which is the stronger check — this
// only has to produce them, and re-produce all of them when a track height moves.
// Shared impl lives in @jbrowse/browser-test-utils, so a sibling site adopting
// this writes only the wrapper below.
import { writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { measureDemoHeights } from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const site = path.join(here, '..')
const outFile = path.join(site, 'demoHeights.json')

const heights = await measureDemoHeights({
  distDir: path.join(site, 'dist'),
  base: config.base,
  // the landing page is deliberately absent: it runs one of these examples a
  // second time and reserves that example's figure, rather than a duplicate of
  // its own that could drift away from it
  slugs: examples.map(e => e.slug),
  log: m => {
    console.log(m)
  },
})

writeFileSync(outFile, `${JSON.stringify(heights, null, 2)}\n`)
console.log(
  `\n${Object.entries(heights)
    .map(([slug, h]) => `  ${slug.padEnd(26)} ${String(h).padStart(4)}px`)
    .join('\n')}\nwrote ${path.relative(site, outFile)}`,
)
