// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  checkDemoAboveFold,
  checkDemoHeights,
  checkTextContrast,
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
// `multiple-tracks` is the deliberate exception: it comes before the page that
// introduces the swap, so it shows what a stock display looks like out of the
// box. Its three are the ambient bottom-right controls — every display with a
// `heightMode` slot draws a track-sizing button, and the feature display adds
// the isoform-collapse notice while genes are collapsed.
//
// **This budget is per document, which is what decides where a page boundary
// may go.** Several demos share a page now (`src/examples.ts` says why), and
// two demos on one page report one number for both. So a stock demo may not
// share a page with a plain one: the merged page would carry the sum, the plain
// half's zero would stop being stated anywhere, and the site's central claim
// would be resting on a number that no longer isolates it. That is the whole
// reason `multiple-tracks` is still a page of its own.
//
// **`ultraminimal` installs no provider either, and its zero is unearned.**
// Both its demos show a lone wiggle track, and the corner controls come from
// canvas's FeatureComponent and the alignments component — wiggle draws none. So
// it scores zero by having no Material widget to suppress, not by suppressing
// one. The day a wiggle display grows an ambient control it will fail this
// budget for a reason that has nothing to do with what it teaches, and the
// obvious fix — installing DisplayUIProvider on the page whose whole point is
// that nothing is drawn around the track — would be the wrong one. Raise it to
// what wiggle actually draws and say so here instead.
//
// Exact equality, in both directions. A new Material widget appearing in a
// display's render path has to be noticed here; so does one disappearing,
// because that is the moment the prose needs rewriting too.
const MUI_BUDGET = {
  // the landing page, which runs the scalebar demo rather than describing it
  '': 0,
  ultraminimal: 0,
  'multiple-tracks': 3,
  'removing-material-ui': 0,
  'loading-and-errors': 0,
  'scalebar-and-labels': 0,
  'controlling-the-view': 0,
  // At rest this page shows a pileup coloured `normal`, which has no key — so
  // this zero is the ordinary one and says nothing about the legend. The legend
  // is a separate check (`legendIsPlainAndAboveTheSeams`), because it has to be
  // driven and because a census that only ever runs before the thing appears is
  // the `ultraminimal` unearned-zero trap one paragraph up.
  'track-settings': 0,
  'search-by-name': 0,
  'local-files': 0,
  'highlight-a-region': 0,
  'web-workers': 0,
  // measured, not chosen -- see the note below the budget
  synteny: 0,
  // Two renderings of the same two tracks on one page -- the canvas stack behind
  // `DisplayUIProvider`, and the SVG figure under it -- and the figure's half of
  // this zero is free rather than installed: an SVG body draws no chrome, and the
  // one thing it draws that a display would (a colour key) is vector. The page
  // does mount a Material `ThemeProvider`, which is what JBrowse's SVG chrome
  // reads its colours from; a provider is not an element, and this number is what
  // says so.
  'svg-figures': 0,
}

// Record every MUI-classed element that is ever inserted, from before the
// page's own scripts run. `recordFromLoad` in the shared harness.
//
// **This is the half the census was missing, and the reason it was missing is
// the sampling instant rather than any assertion.** Everything below runs once
// the page is quiet, and quiet means nothing is loading any more — so a
// component that exists only while something is fetching is gone before
// anything looks. The budget read zero on `synteny` for as long as that page
// existed while it drew a `MuiLinearProgress` on every visit, and no amount of
// care in the at-rest count could have caught it: `ComparativeFetchStatus`
// reaches `@jbrowse/core/ui` directly, so `DisplayUIProvider` never redirected
// it, and the bar was gone by the time the census ran. Same shape as the
// `FloatingLegend` hole below, one step further out — that one needs a click,
// this one needs you not to have waited.
//
// **An interval, and a MutationObserver was tried first and killed the page.**
// Observing `document` with `subtree` + `attributes` looks like the better
// instrument — event-driven, no sampling gap — and on a React page repainting a
// pileup it fires on every frame's class churn, with a `querySelectorAll` walk
// per added subtree. Under swiftshader that wedged the renderer: two runs in
// three died on `multiple-tracks` with a detached frame, and the same runs
// passed with this recorder switched off. One `[class*="Mui"]` query every
// 100ms is a single tree walk against a DOM that is mostly canvas, and three
// full sweeps of the site never cost a page.
//
// The sampling gap that buys is theoretical here: what this is looking for is a
// fetch indicator, which lives for about a second. Something that mounts and
// unmounts inside 100ms is not a thing a reader could see either.
//
// Outermost-ness is decided at sample time, while the element still has a
// parent chain to ask — the same filter the at-rest count applies.
function recordMuiFromLoad() {
  const seen = new Set()
  window.__muiEver = seen
  setInterval(() => {
    for (const el of document.querySelectorAll('[class*="Mui"]')) {
      if (!el.parentElement?.closest('[class*="Mui"]')) {
        seen.add(
          el.getAttribute('aria-label') ||
            el.textContent?.trim().slice(0, 40) ||
            `<${el.tagName.toLowerCase()} class="${el.getAttribute('class')}">`,
        )
      }
    }
  }, 100)
}

// Count the outermost MUI-classed elements (an icon button and the svg inside it
// are one control, not two) and report what they were, since the label is the
// only thing that says which control appeared.
//
// Both instants are held to the same budget. A page's Material is either
// permanent chrome or it is a loading state, and the second one is the one
// nobody notices — so "ever" having a bigger number than "at rest" is not a
// looser bar to record, it is the finding.
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
  const ever = await page.evaluate(() => [...(window.__muiEver ?? [])])
  const out =
    found.length === expected
      ? []
      : [
          `renders ${found.length} Material UI element(s), expected ${expected}:\n` +
            found.map(f => `           - ${f}`).join('\n'),
        ]
  if (ever.length > expected) {
    out.push(
      `rendered ${ever.length} Material UI element(s) at some point during the ` +
        `load, expected ${expected}. A page at rest shows ${found.length}, so ` +
        'the difference only exists while something is fetching — which is ' +
        'where a component behind neither bring-your-own provider hides:\n' +
        ever.map(f => `           - ${f}`).join('\n'),
    )
  }
  return out
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
// above, by name, and double-reporting them would make `multiple-tracks`
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
// controls live there, and hovering one on `multiple-tracks` would mount a
// Material popover that the at-rest count above has no entry for.
// The census runs per track rather than once at the end, because a tooltip is
// only up while the pointer is on the thing that raised it: sweeping every
// track and then looking would only ever see the last position's.
async function censusWhileHovering(page) {
  const found = new Set()
  for (const canvas of await page.$$('canvas')) {
    // `behavior: 'instant'` is not a default worth relying on: a stylesheet
    // that sets `scroll-behavior: smooth` leaves the scroll still animating
    // when `boundingBox()` is read below, and the coordinates are stale by the
    // time the pointer reaches them — see `clicksReachTheTrack`, where the same
    // thing fails loudly.
    await canvas.evaluate(el => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' })
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
  // `behavior: 'instant'`, pinned rather than left to the page: under a
  // stylesheet that sets `scroll-behavior: smooth` this scroll is still
  // animating when `boundingBox()` is read, and on a page tall enough to have
  // somewhere to scroll — which, since demos started sharing pages, is most of
  // them — the click lands wherever the page has slid to by then. It reports as
  // "landed on <html>", which reads like a pan handler eating the click and is
  // not. The shell no longer sets smooth scrolling, and this still does not
  // depend on that.
  await canvas.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' })
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

// The hover sweep's own Material coverage, which it did not have.
//
// `muiThemedStyling` is the only census the sweep runs, and it drops anything
// carrying a `Mui*` class — on the stated grounds that the count above has
// those by name. The count above is `muiBudget`, which runs first and reads
// `window.__muiEver` at that instant, before a pointer has been anywhere. So a
// Material element that exists only while something is under the cursor fell
// between the two: named-but-not-yet, and themed-but-excluded.
//
// The recorder is a `setInterval` nobody clears, so the fix is to read its set
// again once the sweep is done. One `evaluate`, and it holds the union to the
// same number both other instants are held to.
//
// **A tooltip is the shape this is looking for**, because it is the one piece
// of display chrome behind neither bring-your-own provider — a display renders
// it directly, so an embedder installing both plain sets cannot redirect it.
// `BaseTooltip.test.tsx` in `@jbrowse/core` pins today's implementation
// deterministically, which is the right instrument for *that* component; this
// is the one that notices any other Material widget a pointer can raise.
async function muiRaisedByHover(page, slug) {
  const expected = MUI_BUDGET[slug]
  if (expected === undefined) {
    return []
  }
  const ever = await page.evaluate(() => [...(window.__muiEver ?? [])])
  return ever.length <= expected
    ? []
    : [
        `${ever.length} Material UI element(s) had rendered by the end of the ` +
          `hover sweep, expected ${expected}. The same union was within budget ` +
          'before the pointer moved, so the difference is something a hover ' +
          'raises:\n' +
          ever.map(f => `           - ${f}`).join('\n'),
      ]
}

// `getHighlightCoords` earns its place by what it does to awkward input, and
// none of that is visible on a page at rest. The floor is the case worth
// driving: a one-base highlight at 40kb of zoom is a hundredth of a pixel, so
// the method clamps the band to 3px, and losing that clamp reads as "the
// highlight didn't work" rather than as a rendering bug.
async function highlightSurvivesAOneBaseRegion(page, slug) {
  if (slug !== 'highlight-a-region') {
    return []
  }
  const clicked = await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find(e =>
      e.innerText.includes('A single base'),
    )
    el?.click()
    return !!el
  })
  if (!clicked) {
    return ['no "A single base" button on the page']
  }
  try {
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-testid="highlight-band"]')].some(
          el => el.getBoundingClientRect().width >= 3,
        ),
      { timeout: 15000 },
    )
    return []
  } catch {
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="highlight-band"]')].map(
        el => el.getBoundingClientRect().width,
      ),
    )
    return [
      'a one-base highlight zoomed out to 40kb drew no band at least 3px wide ' +
        `— getHighlightCoords' minimum width is gone, or the band is not being ` +
        `drawn at all. Band widths found: ${JSON.stringify(widths)}`,
    ]
  }
}

// Drag-to-zoom on the scalebar, which is the one thing on this site that is
// only a gesture. Every other check censuses a page or clicks one control, and
// a rubberband that stopped working would leave a page that loads, paints and
// reads exactly right — the failure is that nothing happens, which is what a
// census of a page at rest reports on a healthy page too.
//
// The gesture is core's `usePointerDrag` since 2026-08, so this is also the
// only place in the repo that drives that hook through a real browser: its unit
// test covers the handler contract, and this covers the half a stubbed pointer
// cannot — that a press, a stream of moves and a release across a real element
// reach the model and reframe the view.
//
// `page.mouse` is viewport coordinates, so the row is scrolled into view and
// re-measured first, `behavior: 'instant'` pinned rather than left to the page
// (see `clicksReachTheTrack` for what a smooth scroll does to a coordinate).
async function dragToZoomFramesTheSpan(page, slug) {
  if (slug !== 'scalebar-and-labels') {
    return []
  }
  // The row names itself. It used to be picked out of the page's
  // `data-gesture-owner` elements by matching a pixel height restated from the
  // example — which every display's overlay slot is now also a candidate for,
  // and which reports a changed row height as "no scalebar".
  const el = await page.$('[data-testid="scalebar"]')
  if (!el) {
    return ['no scalebar row on the page']
  }
  await el.evaluate(e => {
    e.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
  await new Promise(r => setTimeout(r, 500))
  const box = await el.boundingBox()
  if (!box) {
    return ['the scalebar row has no box (not visible?)']
  }
  const before = await el.evaluate(e => e.innerText)

  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * 0.35, y)
  await page.mouse.down()
  for (const f of [0.45, 0.55, 0.65]) {
    await page.mouse.move(box.x + box.width * f, y)
    await new Promise(r => setTimeout(r, 40))
  }
  // measured mid-drag, because the band is gone by pointerup: this is the half
  // that says the press and the moves arrived, separately from whether the
  // release reframed anything
  const bandWidth = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="rubberband"]')
        ?.getBoundingClientRect().width ?? -1,
  )
  await page.mouse.up()

  const out = []
  if (!(bandWidth > 50)) {
    out.push(
      `dragging a third of the way across the scalebar drew a band ${bandWidth}px ` +
        'wide — the pointer stream is not reaching useRubberband. A press that ' +
        'never captures is the usual cause, and it looks identical to a page ' +
        'that simply ignored the drag.',
    )
  }
  try {
    await page.waitForFunction(
      (e, text) => e.innerText !== text,
      { timeout: 15000 },
      el,
      before,
    )
  } catch {
    out.push(
      'the drag ended and the coordinate labels did not change — pxToBp/moveTo ' +
        `never ran, so the release is being dropped. Labels read: ${JSON.stringify(before)}`,
    )
  }
  return out
}

// The floating colour legend, which is the one piece of display chrome behind
// NEITHER bring-your-own seam: a display renders `FloatingLegend` directly, so
// no provider redirects it and this site's whole claim rests on what that file
// happens to import. It was two Material `IconButton`s and a `Link` until
// 2026-08, and the census scored every page zero throughout — because a legend
// only exists once something picks a colouring that has a key, and until this
// page nothing here ever did.
//
// So the census is re-run with one on screen. Three assertions, and the middle
// one is the one that stops this becoming another unearned zero: the scheme is
// picked, the legend is confirmed *present*, and only then is the count taken.
async function legendIsPlainAndAboveTheSeams(page, slug) {
  if (slug !== 'track-settings') {
    return []
  }
  const picked = await page.evaluate(() => {
    const el = document.querySelector('select')
    if (!el) {
      return false
    }
    // `strand`, because its key has two rows on this BAM rather than the one a
    // scheme whose categories are mostly absent from the window collapses to —
    // so a legend that renders as an empty box would still fail this. Set
    // through the native setter + an input event, because React's onChange
    // listens for the latter and assigning `.value` alone raises none.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value',
    )?.set
    setter?.call(el, 'strand')
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return el.value === 'strand'
  })
  if (!picked) {
    return ['no Color by <select> on the page, or it would not take a scheme']
  }
  // `showLegend` is opt-in — a legend eagerly covering the top of every
  // alignments track is worse than one you asked for — so a scheme with a key
  // is necessary and not sufficient. The page draws the checkbox for it.
  const toggled = await page.evaluate(() => {
    const el = [...document.querySelectorAll('label')]
      .find(l => l.innerText.includes('Show legend'))
      ?.querySelector('input')
    if (!el || el.checked) {
      return !!el
    }
    el.click()
    return true
  })
  if (!toggled) {
    return ['no "Show legend" checkbox on the page']
  }
  try {
    await page.waitForFunction(
      () => !!document.querySelector('[data-testid="floating-legend"]'),
      { timeout: 20000 },
    )
  } catch {
    return [
      'picking `strand` and ticking Show legend raised no legend — the scheme ' +
        'stopped having a key, the opt-in stopped working, or the display ' +
        'stopped drawing it. Without a legend on screen the zero this page ' +
        'reports is about nothing.',
    ]
  }
  const rows = await page.evaluate(
    () =>
      document.querySelector('[data-testid="floating-legend"]')?.innerText ??
      '',
  )
  if (!rows.includes('Forward strand') || !rows.includes('Reverse strand')) {
    return [
      'the legend rendered but does not name both strands — a key is derived ' +
        `from the reads laid out in the window, so this is the demo's data or ` +
        `its start location moving, not the legend. Read:\n${rows}`,
    ]
  }
  const out = []

  const found = await page.evaluate(() =>
    [
      ...document
        .querySelector('[data-testid="floating-legend"]')
        .querySelectorAll('[class*="Mui"]'),
    ].map(el => el.getAttribute('class')),
  )
  if (found.length > 0) {
    out.push(
      `the colour legend renders ${found.length} Material UI element(s), and ` +
        'no provider can swap them — a host that mounted DisplayUIProvider to ' +
        `avoid exactly this gets them anyway:\n${found.map(f => `           - ${f}`).join('\n')}`,
    )
  }

  // The other half, and the reason this page draws seams at all: the legend has
  // to paint ABOVE them. Not `elementFromPoint`, which would pass whatever the
  // z-order is — the seams are `pointer-events: none`, so hit testing skips
  // them and the check would be about nothing. The mechanism is asked instead:
  // did the legend land in the slot's overlay node, and does that node outrank
  // the seam layer?
  //
  // Both ends are named by a marker rather than found by shape.
  // `data-track-overlay-node` is the node itself and `data-region-seams` is
  // what the example draws over the stack — the walk up the tree sniffing for
  // `contain: strict` and the `.demo div[aria-hidden]` that stood in for the
  // seams were each one refactor away from silently matching nothing.
  const order = await page.evaluate(() => {
    const z = el => Number.parseInt(getComputedStyle(el).zIndex, 10)
    const node = document
      .querySelector('[data-testid="floating-legend"]')
      ?.closest('[data-track-overlay-node]')
    const seams = document.querySelector('[data-region-seams]')
    return {
      escaped: !!node,
      legendZ: node && z(node),
      seamZ: seams && z(seams),
    }
  })
  if (!order.escaped) {
    out.push(
      'the legend is still inside the display sandbox — TrackOverlaySlot is ' +
        'not wrapping the display, or TrackOverlayPortal fell back to inline. ' +
        'It will render under the region seams.',
    )
  } else if (!(order.legendZ > order.seamZ)) {
    out.push(
      `the legend escaped the sandbox but sits at z-index ${order.legendZ}, ` +
        `not above the seams at ${order.seamZ} — the slot's zIndex prop and ` +
        'what the page paints over the stack have drifted apart.',
    )
  }
  return out
}

// The generalisation of the check above, to every page and every piece of
// floating chrome rather than to the one page that happens to raise a legend.
//
// A display floats its chrome — the bottom-right controls, the colour key, the
// loading scrim, the error bar — out of its `contain: strict` sandbox through
// `TrackOverlayPortal`, and the host mounts the node it lands in
// (`TrackOverlaySlot`). Leave the slot out and the portal falls back to
// rendering **in place**, back inside the sandbox, where anything the page
// paints over the track stack buries it and no z-index inside the box can win.
//
// Fourteen of this site's fifteen demos did exactly that, and every check here
// stayed green, because nothing about a page at rest looks wrong: the corner
// control is in a corner, the seams are two pixels wide, and the state that
// would show it — a fetch in flight over a two-region view, a legend on,
// whole-genome zoom where most spans elide — is not a state a census reaches.
//
// **Two markers, one selector, no list of chrome.** `data-display-id` is on the
// display root and `data-track-overlay-slot` on the slot, so the whole contract
// is "every display is inside a slot" — which is also the floor, since a demo
// page that mounted no display at all fails on the count rather than passing by
// having nothing to look at. Enumerating the chrome instead (`track-control-*`,
// `floating-legend`, …) would need editing every time a display grows a piece,
// and a stale list reads as a clean run.
async function everyDisplayIsInAnOverlaySlot(page) {
  const found = await page.evaluate(() => {
    const displays = [...document.querySelectorAll('[data-display-id]')]
    return {
      total: displays.length,
      orphans: displays
        .filter(el => !el.closest('[data-track-overlay-slot]'))
        .map(el => el.dataset.displayId),
    }
  })
  if (found.total === 0) {
    return [
      'no display mounted on this page — every demo here mounts at least one, ' +
        'so this is a page that failed to hydrate rather than a page with ' +
        'nothing to check.',
    ]
  }
  return found.orphans.length > 0
    ? [
        `${found.orphans.length} of ${found.total} display(s) are not inside a ` +
          `TrackOverlaySlot: ${found.orphans.join(', ')}. Their floating chrome ` +
          'stays sealed in the `contain: strict` sandbox, where anything the ' +
          'page paints over the stack buries it with nothing to say so.',
      ]
    : []
}

// Both halves of the local-file page, neither of which exists until a click.
//
// The page's claim is a pipeline — bytes become a blob location, a name becomes
// an adapter, an adapter becomes a track — and every link in it fails silently.
// `guessAdapter` answers `UNKNOWN` rather than throwing, `addSessionTrackConf`
// reports a config it rejects on the snackbar channel this page does not draw,
// and a blob whose index was not paired reads the data file as its own index,
// which fails inside the adapter. At rest the page is one URL track and a row
// of buttons, so a run that only loads it cannot tell working from broken.
//
// The mismatch notice is the second half and the reason the page exists: it is
// the only signal that a file's contig names and the genome's have nothing in
// common, JBrowse's own presentation of it lives on a track label this site
// never draws, and it is drawn here from `track.refNameMismatch`. So it is
// asserted on the text of the published message rather than on a class or a
// count — a notice drawn by nothing is what this catches.
async function localFileOpensAsATrack(page, slug) {
  if (slug !== 'local-files') {
    return []
  }
  // by name, with a synthetic click: nothing here is about whether a click
  // reaches a target through the pan handler (`clicksReachTheTrack` owns that),
  // and a coordinate failure reported as a pipeline failure would be a worse
  // message than either
  const clickByText = text =>
    page.evaluate(t => {
      const el = [...document.querySelectorAll('button')].find(e =>
        e.innerText.includes(t),
      )
      el?.click()
      return !!el
    }, text)
  const displayCount = () =>
    page.evaluate(() => document.querySelectorAll('[data-display-id]').length)
  const demoText = () =>
    page.evaluate(() => document.querySelector('.demo')?.innerText ?? '')

  const out = []
  const before = await displayCount()

  if (!(await clickByText('Open a BAM for me'))) {
    return ['no "open a BAM" button on the page']
  }
  try {
    // the fetch is ~400 KB and the pileup then has to lay out, so this is the
    // long wait on the page
    await page.waitForFunction(
      n => document.querySelectorAll('[data-display-id]').length > n,
      { timeout: 30000 },
      before,
    )
    // the opened track mounts through the same `TrackRow` as the static one, so
    // its display owes the same slot — and at-rest is the only instant the
    // shared check above could have seen
    out.push(...(await everyDisplayIsInAnOverlaySlot(page)))
  } catch {
    out.push(
      'a local file was registered and no display appeared, so one of ' +
        'storeBlobLocation / guessAdapter / guessTrackType / ' +
        'addSessionTrackConf / showTrack stopped working without throwing. ' +
        `Demo read:\n${await demoText()}`,
    )
  }

  if (!(await clickByText('another genome'))) {
    return [...out, 'no "file from another genome" button on the page']
  }
  try {
    await page.waitForFunction(
      () =>
        document
          .querySelector('.demo')
          ?.innerText.includes('reference sequence names match'),
      { timeout: 20000 },
    )
    // raised by a click, so the at-rest contrast pass never sees it — and it is
    // the one thing on this page a reader has to be able to read, since it is
    // the only account of why their own file drew nothing
    out.push(...(await checkTextContrast(page)))
  } catch {
    out.push(
      'a track whose refNames share nothing with the assembly drew no ' +
        'notice, so `track.refNameMismatch` is no longer reaching the screen ' +
        'and the commonest data mistake there is looks like an empty region. ' +
        `Demo read:\n${await demoText()}`,
    )
  }
  return out
}

// The one page whose subject is a state you cannot see by loading it.
//
// `loading-and-errors` argues that a host gating on `view.ready` alone ships an
// empty box: false for a failed load, and true for a view nothing has navigated
// yet. Neither shows up on an idle page, and neither does the snackbar channel
// that carries the failures the view has no state for. Every other check in
// this file censuses a page at rest, where this page looks exactly like its
// neighbours — so its claim was verified once, by hand, and nothing stopped the
// next change from making it blank again. All three are driven here.
//
// `el.click()` rather than `page.mouse.click`, deliberately, and it is the
// opposite call from the one `clicksReachTheTrack` makes: that check is *about*
// whether a click reaches its target through the page's own pan handler, so it
// has to go through the pointer. This one only needs to drive the UI, and a
// synthetic click on a control by name can't fail for a coordinate reason and
// report it as a rendering one.
//
// Runs last. Picking the broken scenario replaces the engine with one that has
// no canvas, so anything after it would be censusing a different page.
async function viewStatusStatesAreDrawn(page, slug) {
  if (slug !== 'loading-and-errors') {
    return []
  }
  const clickByText = async text => {
    const clicked = await page.evaluate(t => {
      const el = [...document.querySelectorAll('button, label')].find(e =>
        e.innerText.includes(t),
      )
      el?.click()
      return !!el
    }, text)
    return clicked
  }
  const demoText = () =>
    page.evaluate(() => document.querySelector('.demo')?.innerText ?? '')

  const out = []

  // half one: session.snackbarMessages. `showTrack` with an id that is not in
  // the config returns undefined and reports the reason there, so a host that
  // does not read the array shows nothing at all.
  if (!(await clickByText("isn't in the config"))) {
    return ['no "show a track that isn\'t in the config" button on the page']
  }
  try {
    await page.waitForFunction(
      () =>
        document
          .querySelector('.demo')
          ?.innerText.includes('Could not resolve'),
      { timeout: 5000 },
    )
  } catch {
    out.push(
      'showTrack with an unresolvable id drew no notification — ' +
        `session.snackbarMessages is not reaching the screen. Demo read:\n${await demoText()}`,
    )
  }

  // …and now that it is on screen, is it readable? This is the one place the
  // repo's actual dark-mode bug can be caught, rather than a sibling of it: the
  // snackbar exists only after the click above, so the at-rest contrast pass in
  // the check list never sees it, and for as long as `color-scheme` went
  // undeclared this notification — the single thing this page exists to prove a
  // host must render — sat at 1.0:1 in dark mode with every check green.
  // Drawing it and reading it are two different claims and both are this
  // function's.
  out.push(...(await checkTextContrast(page)))

  // half two: view.status noRegions, the state `view.ready` answers "ready" to.
  // The radio builds an engine with no `init`, so nothing has told the view
  // where to look, and the panel's button hands it one through `setInit`.
  //
  // **Both ends are asserted, and the second is the one that keeps the page
  // honest.** Every other radio here is a state to be drawn; this one is a
  // state to be *left*, and a host that draws it over a view it never lets the
  // reader navigate has shipped the same empty box under a nicer caption.
  //
  // This scenario is also the only input on the site that reaches the branch at
  // all. Every `ViewStatus` here renders a `noRegions` arm and every
  // `createViewState` call used to pass `init`, so the state the page argues
  // `view.ready` gets wrong was drawn by nothing, anywhere.
  if (!(await clickByText('no location yet'))) {
    return [...out, 'no unnavigated scenario radio on the page']
  }
  try {
    await page.waitForFunction(
      () =>
        document
          .querySelector('.demo')
          ?.innerText.includes('where to look yet'),
      { timeout: 10000 },
    )
  } catch {
    out.push(
      'an engine built with no `init` drew no noRegions state — the fourth ' +
        'value of view.status is back to rendering nothing, which is the state ' +
        `view.ready reports as ready. Demo read:\n${await demoText()}`,
    )
  }
  if (await clickByText('Show ctgA')) {
    try {
      await page.waitForFunction(
        () => !!document.querySelector('[data-display-id]'),
        { timeout: 30000 },
      )
    } catch {
      out.push(
        'setInit on a view in noRegions mounted no display — the state has no ' +
          `way out, so drawing it buys the reader nothing. Demo read:\n${await demoText()}`,
      )
    }
  } else {
    out.push('no navigate button in the noRegions panel')
  }

  // half three: view.error. The radio builds a fresh engine on an assembly whose
  // sequence file 404s, which is the state `view.ready ? tracks : null` renders
  // as an empty box with nothing anywhere saying why.
  if (!(await clickByText('behind a 404'))) {
    return [...out, 'no "behind a 404" scenario radio on the page']
  }
  try {
    await page.waitForFunction(
      () =>
        document.querySelector('.demo')?.innerText.includes('could not load'),
      { timeout: 30000 },
    )
  } catch {
    out.push(
      'a 404 assembly drew no error — the view-level error state is back to ' +
        `rendering nothing, which is the bug this page exists to name. Demo read:\n${await demoText()}`,
    )
  }
  return out
}

// Everything the search page claims is a state you get to by typing, and two of
// the three are *absences* — a search that resolves nothing, a search that
// resolves several things and goes nowhere. A census at rest cannot tell any of
// them from a page whose index URL 404s, which is the failure this is really
// here for: the trix files are hosted rather than in this repo, so the demo can
// stop working without a line of it changing.
//
// Scoped to the first `<section>` by id, because the second one's result rows
// are also buttons and several of them contain the word EDEN. Exact text match
// on the button for the same reason — `includes('EDEN')` finds `EDEN.1` first,
// which is a different one of the four paths.
async function searchByNameResolvesNames(page, slug) {
  if (slug !== 'search-by-name') {
    return []
  }
  const out = []

  // No interaction for this one: the dropdown's box starts on `EDEN`, so a
  // populated list is the evidence that `fetchResults` reached the hosted index
  // and parsed it. Both columns are checked — the label proves the query
  // matched, the trackId proves the row was decoded rather than guessed.
  try {
    await page.waitForFunction(
      () => {
        const t =
          document.querySelector('[data-testid="search-results"]')?.innerText ??
          ''
        return t.includes('EDEN.1') && t.includes('gff3tabix_genes')
      },
      { timeout: 30000 },
    )
  } catch {
    const listed = await page.evaluate(
      () =>
        document.querySelector('[data-testid="search-results"]')?.innerText ??
        '(no result list rendered)',
    )
    out.push(
      'the dropdown searched for EDEN and did not list EDEN.1 from ' +
        `gff3tabix_genes — fetchResults or the hosted trix index is not ` +
        `answering. List read:\n${listed}`,
    )
  }

  const clickInFirstSection = async label =>
    page.evaluate(t => {
      const el = [
        ...(document
          .querySelector('#search-by-name')
          ?.querySelectorAll('button') ?? []),
      ].find(e => e.innerText.trim() === t)
      el?.click()
      return !!el
    }, label)

  // The page's sharpest claim: a query with no exact match and several prefix
  // ones cannot navigate, so JBrowse queues a dialog and this host draws none.
  // `Apple` and not `EDEN` — EDEN prefixes four features and is exactly one of
  // them, so the exact pass wins and it navigates, which is the neighbouring
  // button and the distinction the page is about.
  if (await clickInFirstSection('Apple')) {
    try {
      await page.waitForFunction(
        () => !!document.querySelector('[data-testid="queued-dialog-notice"]'),
        { timeout: 30000 },
      )
    } catch {
      out.push(
        'searching the ambiguous name Apple queued no dialog — either the ' +
          'multi-hit path stopped going through session.queueDialog, or the ' +
          'index stopped returning more than one non-exact hit for it',
      )
    }
  } else {
    out.push('no exact "Apple" button in the first section')
  }

  // Clear it before the next click, or the EDEN check below reads Apple's
  // notice and reports the opposite of what happened.
  await clickInFirstSection('Dismiss')
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="queued-dialog-notice"]'),
    { timeout: 5000 },
  )

  // The other half of that pair, and the reason the one above says "no exact
  // match" rather than "several hits": EDEN is ambiguous by prefix and still
  // must not ask. Losing the exact-first pass would make this queue a dialog.
  if (await clickInFirstSection('EDEN')) {
    await new Promise(r => setTimeout(r, 3000))
    const queued = await page.evaluate(
      () => !!document.querySelector('[data-testid="queued-dialog-notice"]'),
    )
    if (queued) {
      out.push(
        'searching EDEN queued a dialog — the exact pass no longer runs ' +
          'before the prefix one, so a gene that prefixes its own isoforms ' +
          'now opens a picker instead of navigating',
      )
    }
  } else {
    out.push('no exact "EDEN" button in the first section')
  }

  // And the other absence: a plain word with no hits is a typed throw the page
  // renders as prose, not an error.
  if (await clickInFirstSection('zyzzyva')) {
    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector('#search-by-name')
            ?.innerText.includes('No results found'),
        { timeout: 30000 },
      )
    } catch {
      out.push(
        'a search for zyzzyva drew no "no results" line — ' +
          'SearchResultsNotFoundError is no longer reaching the page',
      )
    }
  } else {
    out.push('no exact "zyzzyva" button in the first section')
  }

  return out
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
  workerSlug: 'web-workers',
  // installed before each page's own scripts, so `muiBudget` can hold the
  // census to what ever rendered rather than to what survived the load
  recordFromLoad: recordMuiFromLoad,
  // The two console errors on this site that are a page working rather than
  // failing: `loading-and-errors` points a radio at an assembly whose sequence
  // file does not exist, and `viewStatusStatesAreDrawn` below clicks it, while
  // `removing-material-ui` carries a "track that fails to load" so its
  // bring-your-own error overlay has something to draw. Both named down to the
  // URL on purpose — a filter matching "404" would waive the ordinary
  // broken-data-link regression they look exactly like, on every page.
  allowedConsoleError: (text, slug) =>
    (slug === 'loading-and-errors' && text.includes('does-not-exist.2bit')) ||
    (slug === 'removing-material-ui' && text.includes('does-not-exist.bw')),
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
    // the other half of that sweep: what it raised that carries a Mui class,
    // which the sweep's own census filters out
    ...(await muiRaisedByHover(page, slug)),
    // Toggles the theme to dark and back, so it goes before everything below,
    // which clicks. It is also the check with the most to say on this site
    // specifically: these demos may not use the shell's custom properties, so
    // they style themselves with CSS system colours, which is the thing that
    // silently stops tracking the page when the theme plumbing is wrong.
    ...(await checkTextContrast(page)),
    ...(await clicksReachTheTrack(page)),
    ...(await highlightSurvivesAOneBaseRegion(page, slug)),
    ...(await dragToZoomFramesTheSpan(page, slug)),
    ...(await searchByNameResolvesNames(page, slug)),
    ...(await legendIsPlainAndAboveTheSeams(page, slug)),
    ...(await everyDisplayIsInAnOverlaySlot(page)),
    // adds displays to its own page, so it goes after every census above
    ...(await localFileOpensAsATrack(page, slug)),
    // last: this one replaces the engine on the page it runs on
    ...(await viewStatusStatesAreDrawn(page, slug)),
  ],
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
