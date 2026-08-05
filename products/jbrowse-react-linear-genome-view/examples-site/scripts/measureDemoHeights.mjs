// Write the height each demo settles at, which src/siteMeta.ts reserves on its
// box so the page doesn't jump when the island mounts:
//
//   pnpm build && pnpm measure-demo-heights && pnpm build
//
// Twice, because unlike the other measured artifacts in these sites this one is
// an *input* to the build: the first pass gives it something to measure, the
// second ships the result. Measuring neutralises each box's current
// reservation, so a stale number in the tree cannot influence the new one.
//
// Shared impl lives in @jbrowse/browser-test-utils, so every product's script
// stays identical. It loads each page at two widths and keeps the taller
// figure, because the rule is reserve the tallest: too small still jumps the
// page, while too large only leaves space inside the demo's own border.
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
  // the landing page is deliberately absent: where it runs a demo at all it is
  // running one of these examples a second time, and it reserves that example's
  // figure rather than a duplicate of its own that could drift away from it
  slugs: examples.filter(e => !e.skipSmoke).map(e => e.slug),
  log: m => {
    console.log(m)
  },
})

writeFileSync(outFile, `${JSON.stringify(heights, null, 2)}\n`)
console.log(
  `\n${Object.entries(heights)
    .map(([slug, h]) => `  ${slug.padEnd(30)} ${String(h).padStart(4)}px`)
    .join('\n')}\nwrote ${path.relative(site, outFile)}`,
)
