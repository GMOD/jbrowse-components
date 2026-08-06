import type { Page } from 'puppeteer'

// Per-page assertions for examples-site smoke runs — the `check` hook of
// smokeExamplesSite. These live here rather than in each site's smoke.mjs
// because all three products ship the same demos of the same shared API, and a
// check that drifts between them stops being a guard. (The
// don't-factor-anything-out rule in each site's CLAUDE.md is about the *example
// files*, which a reader has to be able to paste; scripts are not that.)

// How far a demo may sit from the space held for it. The two edges are not
// symmetric, because the two mistakes are not. A demo taller than its
// reservation jumps the page, which is the whole failure being prevented, so
// that edge is tight — and note that under-reserving is not a return to no
// reservation at all: what jumps is only the leftover, not the whole demo.
//
// A demo *shorter* than its reservation just leaves space inside its own
// border, and is routinely correct: the figure reserved is the tallest the demo
// gets across widths, and this viewport is the wide one, where a demo that
// reflows is legitimately shorter. lgv's single-cell-umap is 1546px here and
// 1714px narrow, reproducibly — 168px apart, and neither is wrong. So the loose
// edge is a ratio rather than a distance, and it is only trying to catch a
// figure that has gone stale by an amount no reflow explains.
const TALLER_PX = 12
const SHORTEST_FRACTION = 0.5

/**
 * Check that every demo box on the page still holds the space its demo needs.
 *
 * These demos are all `client:only`, and Astro gives an island
 * `display: contents`, so a demo box is empty and 0 high until React hydrates —
 * several hundred KB later. `demoHeights.json` (written by
 * `pnpm measure-demo-heights`) is reserved on the box as a min-height so the
 * page doesn't drop everything below it when the demo lands.
 *
 * Measured with each box's own reservation neutralised, and read off the
 * element rather than re-importing the table, so this checks what the page
 * actually shipped and covers a page stacking several demos without having to
 * know which section is which.
 *
 * A `.fill` box is skipped: that site fixes its demo height in CSS, so it owns
 * its space already and has nothing to reserve.
 */
export async function checkDemoHeights(page: Page): Promise<string[]> {
  const boxes = await page.$$eval('.demo', els =>
    // narrowed rather than asserted: `.demo` is not a tag selector, so
    // puppeteer types the callback's elements as bare `Element`, which has no
    // `style`
    els
      .filter(el => el instanceof HTMLElement)
      .map(el => {
        const before = el.style.minHeight
        el.style.minHeight = '0px'
        const settled = Math.round(el.getBoundingClientRect().height)
        el.style.minHeight = before
        return {
          fill: el.classList.contains('fill'),
          reserved: Math.round(Number.parseFloat(el.style.minHeight) || 0),
          settled,
        }
      }),
  )
  return boxes.flatMap(({ fill, reserved, settled }) => {
    if (fill) {
      return []
    }
    if (reserved === 0) {
      return [
        `demo box reserves no height (it settles at ${settled}px), so the page ` +
          'jumps when the island mounts — run `pnpm measure-demo-heights`, then ' +
          'build again to ship the result',
      ]
    }
    if (settled > reserved + TALLER_PX) {
      return [
        `demo settles at ${settled}px, taller than the ${reserved}px reserved ` +
          'for it, so the page jumps when it mounts — re-run ' +
          '`pnpm measure-demo-heights`',
      ]
    }
    if (settled < reserved * SHORTEST_FRACTION) {
      return [
        `demo settles at ${settled}px, less than half the ${reserved}px ` +
          'reserved for it, which is too far apart for a reflow to explain — ' +
          're-run `pnpm measure-demo-heights`',
      ]
    }
    return []
  })
}

/**
 * Drive a session-in-url demo's real round trip: save the live session into the
 * URL, reload, and confirm the app came back up from it. Both halves are
 * browser-only — deflate + base64 on the way out, the hash read and restore on
 * the way back — so a unit test can't stand in for this.
 *
 * Assumes the demo renders a save button and reports `restored "<name>"` once a
 * session in the URL is applied.
 */
export async function checkSessionUrlRoundTrip(page: Page): Promise<string[]> {
  // scoped to .demo: the doc prose above it renders code blocks that carry
  // their own copy buttons
  const button = await page.$('#session-in-url .demo button')
  if (!button) {
    return ['session-in-url: save button not rendered']
  }
  await button.click()
  const saved = await page
    .waitForFunction(() => window.location.hash.includes('session=encoded-'), {
      timeout: 10000,
    })
    .then(() => true)
    .catch(() => false)
  if (!saved) {
    const hash = await page.evaluate(() => window.location.hash)
    return [`session-in-url: save did not write a session to the url (${hash})`]
  }
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  return page
    .waitForFunction(
      () =>
        (
          document.querySelector('#session-in-url .demo')?.textContent ?? ''
        ).includes('restored "'),
      { timeout: 30000 },
    )
    .then(() => [])
    .catch(() => ['session-in-url: the session in the url did not restore'])
}

/**
 * Confirm a runtime-loaded plugin actually took effect, when it loaded at all.
 *
 * If the bundle fetch failed (registry down, no network) this passes — that's
 * an environment problem, already filtered as network noise. But if the bundle
 * DID load and the app still can't resolve the types it provides, the wiring
 * dropped the plugin on the way into the PluginManager, which a load-only check
 * can't see: the page renders, the track just errors.
 *
 * `globalName` is the global a UMD bundle assigns as it evaluates.
 */
export async function checkPluginTookEffect(
  page: Page,
  globalName: string,
): Promise<string[]> {
  const loaded = await page.evaluate(
    name => name in window,
    globalName as keyof Window & string,
  )
  if (!loaded) {
    return []
  }
  const text = await page.evaluate(() => document.body.innerText)
  return /unknown (adapter|track) type/i.test(text)
    ? [`${globalName} loaded but the app did not register its types`]
    : []
}

/**
 * The first demo on a page has to begin above the fold.
 *
 * This is the whole premise of the page order — heading, then demo, then the
 * prose annotating it — and it is a property nothing else checks. It regresses
 * the same quiet way every time: someone adds a paragraph to a lead, or a
 * fourth section to a page's "On this page" card, and the demo slides under the
 * fold on a laptop while every existing check stays green, because the page
 * still builds and the island still mounts.
 *
 * Geometry only, so it does not care whether the demo actually drew: the box
 * owns its height before React arrives, which is what `demoHeights` (and, on
 * react-app, the `80vh` `.fill` rule) exist to guarantee.
 *
 * The bound is the viewport height rather than a tuned number — the claim is
 * "the demo starts on the first screen", nothing finer. At the time of writing
 * the worst page sits at 553 of 900, so there is real headroom before this
 * fires.
 */
export async function checkDemoAboveFold(page: Page): Promise<string[]> {
  const found = await page.evaluate(() => {
    const demo = document.querySelector('.demo')
    if (!demo) {
      return null
    }
    return {
      top: Math.round(demo.getBoundingClientRect().top + window.scrollY),
      fold: window.innerHeight,
    }
  })
  // a page with no demo is a page this has nothing to say about
  if (!found || found.top <= found.fold) {
    return []
  }
  return [
    `the first demo starts at ${found.top}px, below the ${found.fold}px fold — ` +
      'a reader meets only prose on the first screen. Shorten what precedes it ' +
      'rather than moving the demo down the page',
  ]
}
