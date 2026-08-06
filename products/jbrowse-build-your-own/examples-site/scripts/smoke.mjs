// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  checkDemoAboveFold,
  checkDemoHeights,
  smokeExamplesSite,
} from '@jbrowse/browser-test-utils'

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
// **`pan-and-zoom` and `one-track` install no provider either, and their zero is
// unearned.** Both show a lone wiggle track, and the corner controls come from
// canvas's FeatureComponent and the alignments component — wiggle draws none. So
// those two score zero by having no Material widget to suppress, not by
// suppressing one. The day a wiggle display grows an ambient control they will
// fail this budget for a reason that has nothing to do with what they teach, and
// the obvious fix — installing DisplayUIProvider on the page whose whole point is
// "no chrome at all" — would be the wrong one. Raise it to what wiggle actually
// draws and say so here instead.
//
// Exact equality, in both directions. A new Material widget appearing in a
// display's render path has to be noticed here; so does one disappearing,
// because that is the moment the prose needs rewriting too.
const MUI_BUDGET = {
  // the landing page, which runs the Pan and zoom demo rather than describing it
  '': 0,
  'pan-and-zoom': 0,
  'one-track': 0,
  'a-stack-of-tracks': 3,
  'bring-your-own-overlays': 0,
  'add-the-chrome-you-want': 0,
  'a-scalebar-not-a-ruler': 0,
  'drive-it-from-your-app': 0,
  'every-chromosome': 0,
  'your-own-feature-details': 0,
  'run-it-in-a-worker': 0,
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

// The second half of the census, and the one that catches what counting `Mui*`
// classnames cannot.
//
// `makeStyles` (`@jbrowse/core/util/tss-react`) emits an emotion class —
// `css-5970li`, no `Mui` anywhere in it — while reading the Material UI
// *theme*. So a component can be fully MUI-styled and score zero above. That
// was not hypothetical: `BaseTooltip` rendered a grey Material chip in Roboto
// on every one of these pages, and the count said zero, which is the worst
// failure shape there is — silent, and endorsed by a green check.
//
// The fingerprint is the font. A host that mounts no `ThemeProvider` (every
// page here) gets MUI's *default* theme, whose typography is
// `Roboto, Helvetica, Arial, sans-serif`; this site's own stack starts with
// `-apple-system`, so an element computing Roboto first did not inherit it from
// the page — something stated it, and the only thing on these pages that can is
// the MUI theme.
//
// Elements inside a `Mui*`-classed subtree are excluded: those are counted
// above, by name, and double-reporting them would make `a-stack-of-tracks`
// (which shows stock chrome on purpose) fail twice for one control. **Zero is
// the bar on every page**, that one included — its three Material widgets are
// unstyled by typography, and a tooltip is not one of them.
async function muiThemedStyling(page, when) {
  const found = await page.evaluate(() => {
    const themed = [...document.querySelectorAll('body *')].filter(el =>
      getComputedStyle(el).fontFamily.startsWith('Roboto'),
    )
    return themed
      .filter(el => !el.closest('[class*="Mui"]'))
      .filter(el => !themed.some(o => o !== el && o.contains(el)))
      .map(
        el =>
          `<${el.tagName.toLowerCase()} class="${el.getAttribute('class') ?? ''}"> ` +
          `${el.textContent.trim().slice(0, 40)}`,
      )
  })
  return found.length === 0
    ? []
    : [
        `${when}: ${found.length} element(s) styled from Material UI's default theme:\n` +
          found.map(f => `           - ${f}`).join('\n'),
      ]
}

// Move the pointer across each track, so the census above sees the hover states
// too — a tooltip only exists while something is under the cursor, and it is
// drawn by the display itself rather than by either bring-your-own provider, so
// it is the state most likely to smuggle a themed component onto the screen.
//
// Deliberately opportunistic: whether a given pixel in a headless swiftshader
// render has a feature under it is not something to build a hard assertion on,
// and a hover that finds nothing simply censuses an unchanged page.
// `BaseTooltip.test.tsx` in `@jbrowse/core` is the deterministic half of this.
//
// The sweep stays out of the bottom-right quadrant on purpose: the corner
// controls live there, and hovering one on `a-stack-of-tracks` would mount a
// Material popover that the at-rest count above has no entry for.
// The census runs per track rather than once at the end, because a tooltip is
// only up while the pointer is on the thing that raised it: sweeping every
// track and then looking would only ever see the last position's.
async function censusWhileHovering(page) {
  const found = new Set()
  for (const canvas of await page.$$('canvas')) {
    await canvas.evaluate(el => {
      el.scrollIntoView({ block: 'center' })
    })
    await new Promise(r => setTimeout(r, 200))
    const box = await canvas.boundingBox()
    if (!box || box.height < 40) {
      continue
    }
    for (const fx of [0.3, 0.45, 0.6]) {
      for (const fy of [0.25, 0.5]) {
        await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy)
        await new Promise(r => setTimeout(r, 120))
      }
    }
    for (const message of await muiThemedStyling(page, 'while hovering')) {
      found.add(message)
    }
  }
  return [...found]
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
  // '' first: the landing page runs a live demo, so it gets the same census as
  // any example page rather than being the one page nothing loads
  slugs: ['', ...examples.filter(e => !e.skipSmoke).map(e => e.slug)],
  // The one page that passes `makeWorkerInstance`. Every other demo here runs
  // main-thread RPC, so this slug is the site's only guard on the Rollup
  // circular-dependency TDZ that webpack tolerates and Vite does not — and the
  // page's own claim is that a worker spawns, which loading it cannot show.
  workerSlug: 'run-it-in-a-worker',
  //
  // The census runs before the click: opening one of those bottom-right menus
  // mounts a Material popover, which would land in the count. It runs twice,
  // either side of a hover, because the states a display draws while the
  // pointer is over it are outside both bring-your-own providers.
  check: async (page, slug) => [
    ...(await muiBudget(page, slug)),
    ...(await checkDemoHeights(page)),
    ...(await checkDemoAboveFold(page)),
    ...(await muiThemedStyling(page, 'at rest')),
    ...(await censusWhileHovering(page)),
    ...(await clicksReachTheTrack(page)),
  ],
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
