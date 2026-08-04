// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical.
import path from 'path'
import { fileURLToPath } from 'url'

import { smokeExamplesSite } from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

// How many Material UI elements each page renders. This whole site is an
// argument about that number, so it is measured rather than claimed — the same
// reason the landing page's bundle figures come out of
// `pnpm measure-chrome-bundle` instead of a comment.
//
// **Zero is the bar** for every page that installs both plain sets
// (`plainChromeOverlays` for the status states, `plainTrackControl` for the
// corner controls). Those pages render JBrowse's own stock wiggle, feature and
// alignments displays, unforked, and nothing Material reaches the screen.
//
// `a-stack-of-tracks` is the deliberate exception: it comes before the page that
// introduces the swap, so it shows what a stock display looks like out of the
// box. Its three are the ambient bottom-right controls — every display with a
// `heightMode` slot draws a track-sizing button, and the feature display adds
// the isoform-collapse notice while genes are collapsed.
//
// Exact equality, in both directions. A new Material widget appearing in a
// display's render path has to be noticed here; so does one disappearing,
// because that is the moment the prose needs rewriting too.
const MUI_BUDGET = {
  'pan-and-zoom': 0,
  'one-track': 0,
  'a-stack-of-tracks': 3,
  'bring-your-own-overlays': 0,
  'add-the-chrome-you-want': 0,
  'your-own-feature-details': 0,
}

// Count the outermost MUI-classed elements (an icon button and the svg inside it
// are one control, not two) and report what they were, since the label is the
// only thing that says which control appeared.
async function muiBudget(page, slug) {
  const expected = MUI_BUDGET[slug]
  if (expected === undefined) {
    return [`no MUI_BUDGET entry for ${slug} — add one to scripts/smoke.mjs`]
  }
  const found = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="Mui"]')]
      .filter(el => !el.parentElement?.closest('[class*="Mui"]'))
      .map(
        el =>
          el.getAttribute('aria-label') ??
          el.textContent.trim().slice(0, 40) ??
          el.tagName.toLowerCase(),
      ),
  )
  return found.length === expected
    ? []
    : [
        `renders ${found.length} Material UI element(s), expected ${expected}:\n` +
          found.map(f => `           - ${f}`).join('\n'),
      ]
}

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
  //
  // The census runs before the click: opening one of those bottom-right menus
  // mounts a Material popover, which would land in the count.
  check: async (page, slug) => [
    ...(await muiBudget(page, slug)),
    ...(await clicksReachTheTrack(page)),
  ],
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
