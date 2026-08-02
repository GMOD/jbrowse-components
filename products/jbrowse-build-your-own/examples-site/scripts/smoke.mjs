// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical.
import path from 'path'
import { fileURLToPath } from 'url'

import { smokeExamplesSite } from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

// Every page here drives the view with a pan handler of its own, and a pan
// handler that captures the pointer on pointerdown quietly eats every click
// inside it: pointer capture retargets the click at the capturing element, so
// the display underneath — its canvas, the buttons it draws in its corner —
// never sees one. Everything still renders, which is why loading the page can't
// catch it. Click for real and check where the click actually landed.
//
// Deliberately asserted on the canvas rather than on a button: JBrowse's own
// chrome claims its press (`data-gesture-owner`), so a button would keep
// working even if the pan handler here regressed. The canvas has no such
// protection, and it is what a reader pasting this handler into their own app
// would lose first.
async function clicksReachTheTrack(page) {
  const canvas = await page.$('canvas')
  if (!canvas) {
    return ['no track canvas on the page']
  }
  await canvas.evaluate(el => {
    el.scrollIntoView({ block: 'center' })
  })
  await new Promise(r => setTimeout(r, 500))
  await page.evaluate(() => {
    window.__smokeClickTarget = 'none'
    document.addEventListener(
      'click',
      e => {
        window.__smokeClickTarget = e.target.tagName.toLowerCase()
      },
      true,
    )
  })
  const box = await canvas.boundingBox()
  if (!box) {
    return ['track canvas has no box (not visible?)']
  }
  await page.mouse.click(
    box.x + box.width / 2,
    box.y + Math.min(30, box.height / 2),
  )
  await new Promise(r => setTimeout(r, 300))
  const target = await page.evaluate(() => window.__smokeClickTarget)
  return target === 'canvas'
    ? []
    : [`a click inside the track landed on <${target}>, not the track canvas`]
}

const failures = await smokeExamplesSite({
  distDir: path.join(here, '..', 'dist'),
  // single source of truth for the base path is astro.config.mjs
  base: config.base,
  slugs: examples.filter(e => !e.skipSmoke).map(e => e.slug),
  // no workerSlug: every demo here runs main-thread RPC, so there is no worker
  // spawn to guard
  check: page => clicksReachTheTrack(page),
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
