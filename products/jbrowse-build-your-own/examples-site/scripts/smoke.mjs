// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// The harness and every check more than one site runs live in
// @jbrowse/browser-test-utils; this file adds what only this site needs.
import path from 'path'
import { fileURLToPath } from 'url'

import {
  checkDemoAboveFold,
  checkDemoHeights,
  checkSessionUrlRoundTrip,
  checkTextContrast,
  smokeExamplesSite,
} from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { pages } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

// How many Material UI elements each page renders. This site is an argument
// about that number, so it is measured rather than claimed.
//
// **Zero is the bar** for every page behind `EmbedProvider`. Those pages render
// JBrowse's own stock wiggle, feature and alignments displays, unforked, and
// nothing Material reaches the screen.
//
// `multiple-tracks` is the deliberate exception: it shows what a stock display
// looks like out of the box. Its three are the ambient bottom-right controls —
// every display with a `heightMode` slot draws a track-sizing button, and the
// feature display adds the isoform-collapse notice while genes are collapsed.
// A stock demo may not share a page with a plain one, since the page carries
// one number for both.
//
// Exact equality, in both directions. A new Material widget appearing in a
// display's render path has to be noticed here; so does one disappearing,
// because that is the moment the prose needs rewriting too.
const MUI_BUDGET = { 'multiple-tracks': 3 }

// Installed before the page's own scripts (`recordFromLoad` in the shared
// harness). `window.__muiCensus` names the outermost MUI-classed elements on
// screen — an icon button and the svg inside it are one control — by label,
// since the label is the only thing that says which control appeared. The
// interval keeps the busiest single sample in `window.__muiPeak`: two controls
// sharing a label count twice, while a control React remounts, or whose label
// changes as it loads, counts once.
//
// **The peak is what catches a loading state.** The at-rest count runs once the
// page is quiet, so a component that exists only while something is fetching is
// gone before it looks: `synteny` drew a `MuiLinearProgress` on every visit
// (`ComparativeFetchStatus` reaches `@jbrowse/core/ui` directly, so
// `DisplayUIProvider` never redirected it) while the at-rest count read zero.
//
// **An interval, because a MutationObserver killed the page.** Observing
// `document` with `subtree` + `attributes` fires on every frame's class churn
// while a pileup repaints, and under swiftshader that wedged the renderer — two
// runs in three died on `multiple-tracks` with a detached frame. One
// `[class*="Mui"]` query every 100ms never cost a page, and a fetch indicator
// lives for about a second.
function recordMuiFromLoad() {
  window.__muiCensus = () =>
    [...document.querySelectorAll('[class*="Mui"]')]
      .filter(el => !el.parentElement?.closest('[class*="Mui"]'))
      .map(
        el =>
          el.getAttribute('aria-label') ||
          el.textContent.trim().slice(0, 40) ||
          `<${el.tagName.toLowerCase()} class="${el.getAttribute('class')}">`,
      )
  window.__muiPeak = []
  setInterval(() => {
    const now = window.__muiCensus()
    if (now.length > window.__muiPeak.length) {
      window.__muiPeak = now
    }
  }, 100)
}

// Both instants are held to the same budget. A page's Material is either
// permanent chrome or it is a loading state, and the second one is the one
// nobody notices — so "ever" having a bigger number than "at rest" is not a
// looser bar to record, it is the finding.
async function muiBudget(page, slug) {
  const expected = MUI_BUDGET[slug] ?? 0
  const found = await page.evaluate(() => window.__muiCensus())
  const ever = await page.evaluate(() => {
    window.__muiPeakBeforeHover = window.__muiPeak
    return window.__muiPeak
  })
  const out =
    found.length === expected
      ? []
      : [
          `renders ${found.length} Material UI element(s), expected ${expected}:\n` +
            found.map(f => `           - ${f}`).join('\n'),
        ]
  if (ever.length > expected) {
    out.push(
      `rendered ${ever.length} Material UI element(s) at once during the ` +
        `load, expected ${expected}. A page at rest shows ${found.length}, so ` +
        'the difference only exists while something is fetching — which is ' +
        'where a component behind neither bring-your-own provider hides:\n' +
        ever.map(f => `           - ${f}`).join('\n'),
    )
  }
  return out
}

// The census that catches what counting `Mui*` classnames cannot.
// `makeStyles` (`@jbrowse/core/util/tss-react`) emits an emotion class —
// `css-5970li`, no `Mui` in it — while reading the Material UI *theme*, so a
// component can be fully MUI-styled and score zero above. `BaseTooltip` did
// exactly that on every page here.
//
// The fingerprint is the font. A host that mounts no `ThemeProvider` (every
// page here) gets MUI's *default* theme, whose typography starts with Roboto;
// this site's own stack starts with `-apple-system`, so an element computing
// Roboto first was styled by the MUI theme.
//
// Elements inside a `Mui*`-classed subtree are counted above, by name, and
// excluded here so `multiple-tracks` doesn't fail twice for one control.
// **Zero is the bar on every page**, that one included.
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
// too: a tooltip is drawn by the display itself rather than by either
// bring-your-own provider, so it is the state most likely to smuggle a themed
// component onto the screen. Opportunistic — a hover that finds no feature
// censuses an unchanged page; `BaseTooltip.test.tsx` in `@jbrowse/core` is the
// deterministic half.
//
// The sweep stays out of the bottom-right quadrant: hovering a corner control
// on `multiple-tracks` would mount a Material popover the at-rest count has no
// entry for. The census runs per track, because a tooltip is only up while the
// pointer is on the thing that raised it.
async function censusWhileHovering(page) {
  const found = new Set()
  for (const canvas of await page.$$('canvas')) {
    // `behavior: 'instant'` pinned: under `scroll-behavior: smooth` the scroll
    // is still animating when `boundingBox()` is read
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
// the display underneath never sees one. Everything still renders, which is why
// loading the page can't catch it. Click for real and check where it landed.
//
// Asserted on the canvas rather than on a button: JBrowse's own chrome claims
// its press (`data-gesture-owner`), so a button would keep working even if the
// pan handler regressed.
async function clicksReachTheTrack(page) {
  const canvas = await page.$('canvas')
  if (!canvas) {
    return ['no track canvas on the page']
  }
  // `behavior: 'instant'` pinned: a click after a still-animating smooth scroll
  // lands wherever the page has slid to, and reports as "landed on <html>",
  // which reads like a pan handler eating the click
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

// `muiThemedStyling` drops anything carrying a `Mui*` class, and `muiBudget`
// read the peak before the pointer had been anywhere, so a Material element
// that exists only while something is under the cursor fell between the two.
// The recorder's interval is never cleared, so its peak is read again after the
// sweep; only a peak the sweep itself set counts, since a load already over
// budget is `muiBudget`'s failure.
async function muiRaisedByHover(page, slug) {
  const expected = MUI_BUDGET[slug] ?? 0
  const raised = await page.evaluate(() =>
    window.__muiPeak === window.__muiPeakBeforeHover ? [] : window.__muiPeak,
  )
  return raised.length <= expected
    ? []
    : [
        `${raised.length} Material UI element(s) were on screen at once ` +
          `during the hover sweep, expected ${expected}:\n` +
          raised.map(f => `           - ${f}`).join('\n'),
      ]
}

// Drag-to-zoom on the scalebar, the one thing on this site that is only a
// gesture: a rubberband that stopped working leaves a page that loads, paints
// and reads exactly right. It is also the only place in the repo that drives
// core's `usePointerDrag` through a real browser — its unit test covers the
// handler contract, this covers a real press, moves and release reaching the
// model.
//
// `page.mouse` is viewport coordinates, so the row is scrolled into view and
// re-measured first (see `clicksReachTheTrack` on `behavior: 'instant'`).
async function dragToZoomFramesTheSpan(page) {
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

// A key the page places is derived from what the display painted, so a row
// naming the data is the proof that the display drew and the page read it.
async function placedKeyNamesItsRows(page, row) {
  try {
    await page.waitForFunction(
      text =>
        document
          .querySelector('[data-testid="embed-legend"]')
          ?.innerText.includes(text),
      { timeout: 60000 },
      row,
    )
    return []
  } catch {
    return [`the key this page places above its track never listed "${row}"`]
  }
}

// SV_20 is a one-base junction, which at the row's 10kb of zoom is a tenth of
// a pixel, so `getHighlightCoords` clamps its band to 3px. Losing that clamp
// reads as "the highlight didn't work" rather than as a rendering bug, and none
// of it is visible on the page at rest.
async function aTableRowMovesTheView(page) {
  const clicked = await page.evaluate(() => {
    const button = document
      .querySelectorAll('tbody tr')[1]
      ?.querySelector('button')
    button?.click()
    return !!button
  })
  if (!clicked) {
    return ['the table has no second row with a button to click']
  }
  try {
    await page.waitForFunction(
      () =>
        document
          .querySelector('tr[aria-selected="true"]')
          ?.innerText.includes('SV_20') &&
        document.querySelector('[data-testid="highlight-band"]')?.innerText ===
          'SV_20' &&
        document
          .querySelector('[data-testid="highlight-band"]')
          .getBoundingClientRect().width >= 3 &&
        [...document.querySelectorAll('[data-gesture-owner]')].some(el =>
          el.innerText.includes('139,97'),
        ),
      { timeout: 60000 },
    )
    return []
  } catch {
    return [
      'clicking the SV_20 button did not select it, mark it with a band 3px or ' +
        'wider and move the view to chr3:139.97 Mb',
    ]
  }
}

// The floating color legend is the one piece of display chrome behind NEITHER
// bring-your-own seam: a display renders `FloatingLegend` directly, so no
// provider redirects it. It only exists once something picks a coloring that
// has a key, so the census is re-run with one on screen — and the legend is
// confirmed *present* before the count is taken, so a zero means something.
async function legendIsPlainAndAboveTheSeams(page) {
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
  // `legend.show` is opt-in — a legend eagerly covering the top of every
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
      `the color legend renders ${found.length} Material UI element(s), and ` +
        'no provider can swap them — a host that mounted DisplayUIProvider to ' +
        `avoid exactly this gets them anyway:\n${found.map(f => `           - ${f}`).join('\n')}`,
    )
  }

  // The other half, and the reason this page draws seams at all: the legend has
  // to paint ABOVE them. Not `elementFromPoint`: the seams are
  // `pointer-events: none`, so hit testing skips them whatever the z-order. The
  // mechanism is asked instead — did the legend land in the slot's overlay
  // node, and does that node outrank the seam layer? Both ends are named by a
  // marker rather than found by shape.
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
// A display floats its chrome — the bottom-right controls, the color key, the
// loading scrim, the error bar — out of its `contain: strict` sandbox through
// `TrackOverlayPortal`, and the host mounts the node it lands in
// (`TrackOverlaySlot`). Leave the slot out and the portal falls back to
// rendering **in place**, back inside the sandbox, where anything the page
// paints over the track stack buries it and no z-index inside the box can win.
//
// Nothing about a page at rest looks wrong when that happens: the state that
// would show it — a fetch in flight over a two-region view, a legend on,
// whole-genome zoom where most spans elide — is not one a census reaches.
//
// **Two markers, no list of chrome**: the contract is "every display is inside
// a slot", and a page that mounted no display fails on the count rather than
// passing with nothing to look at. A list of chrome pieces would go stale and
// read as a clean run.
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
async function localFileOpensAsATrack(page) {
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
    // the fetch is a real ~12.6 MB ONT subset trimmed to one gene, and the
    // pileup then has to lay out, so this is the long wait on the page
    await page.waitForFunction(
      n => document.querySelectorAll('[data-display-id]').length > n,
      { timeout: 90000 },
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
// `view-loading-and-errors` argues that a host gating on `view.ready` alone
// ships an empty box: false for a failed load, and true for a view nothing has
// navigated yet. Neither shows up on an idle page, and neither does the
// snackbar channel that carries the failures the view has no state for, so all
// of them are driven here.
//
// `el.click()` rather than `page.mouse.click`: this only drives the UI (unlike
// `clicksReachTheTrack`), and a synthetic click by name can't fail for a
// coordinate reason and report it as a rendering one.
//
// Runs last. Picking the broken scenario replaces the engine with one that has
// no canvas, so anything after it would be censusing a different page.
async function viewStatusStatesAreDrawn(page) {
  const clickByText = text =>
    page.evaluate(t => {
      const el = [...document.querySelectorAll('button, label')].find(e =>
        e.innerText.includes(t),
      )
      el?.click()
      return !!el
    }, text)
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

  // …and now that it is on screen, is it readable? The snackbar exists only
  // after the click above, so the at-rest contrast pass never sees it, and it
  // once sat at 1.0:1 in dark mode while `color-scheme` went undeclared.
  out.push(...(await checkTextContrast(page)))

  // half two: view.status noRegions, the state `view.ready` answers "ready" to.
  // The radio builds an engine with no `view`, so nothing has told the view
  // where to look, and the panel's button hands it one through `setLaunch`.
  //
  // **Both ends are asserted.** This state is one to be *left*, and a host that
  // draws it over a view the reader can never navigate has shipped the same
  // empty box under a nicer caption.
  if (!(await clickByText('no location yet'))) {
    return [...out, 'no unnavigated scenario radio on the page']
  }
  try {
    await page.waitForFunction(
      () =>
        document.querySelector('.demo')?.innerText.includes('has no location'),
      { timeout: 10000 },
    )
  } catch {
    out.push(
      'an engine built with no `view` drew no noRegions state — the fourth ' +
        'value of view.status is back to rendering nothing, which is the state ' +
        `view.ready reports as ready. Demo read:\n${await demoText()}`,
    )
  }
  if (await clickByText('Show chr17')) {
    try {
      await page.waitForFunction(
        () => !!document.querySelector('[data-display-id]'),
        { timeout: 30000 },
      )
    } catch {
      out.push(
        'setLaunch on a view in noRegions mounted no display — the state has no ' +
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
      () => /could not load/i.test(document.querySelector('.demo')?.innerText),
      { timeout: 30000 },
    )
  } catch {
    out.push(
      'a 404 assembly drew no error — the view-level error state is back to ' +
        `rendering nothing, which is the bug this page exists to name. Demo read:\n${await demoText()}`,
    )
  }

  // half four: the engine build itself throws (a hub name that does not
  // exist), so there is no view to have a status, and only an error boundary
  // above `useCreateViewState` keeps the throw from unmounting the page
  if (!(await clickByText('does not exist'))) {
    return [...out, 'no "hosted genome that does not exist" scenario radio']
  }
  try {
    await page.waitForFunction(
      () =>
        /could not build the view/i.test(
          document.querySelector('.demo')?.innerText,
        ),
      { timeout: 30000 },
    )
  } catch {
    out.push(
      'a failed engine build drew no error — the throw from useCreateViewState ' +
        `is not reaching the page's ErrorBoundary. Demo read:\n${await demoText()}`,
    )
  }
  return out
}

// No interaction for this one: the dropdown's box starts on `BRCA1`, so a
// populated list is the evidence that `view.search` reached the hosted index
// and parsed it. Both columns are checked — `BRCA1P1` (a prefix hit, not the
// typed query itself) proves the query matched, `genes` proves the row was
// decoded rather than guessed.
async function searchResultsListsHits(page) {
  try {
    await page.waitForFunction(
      () => {
        const t =
          document.querySelector('[data-testid="search-results"]')?.innerText ??
          ''
        return t.includes('BRCA1P1') && t.includes('genes')
      },
      { timeout: 30000 },
    )
    return []
  } catch {
    const listed = await page.evaluate(
      () =>
        document.querySelector('[data-testid="search-results"]')?.innerText ??
        '(no result list rendered)',
    )
    return [
      'the dropdown searched for BRCA1 and did not list BRCA1P1 from ' +
        `genes — view.search or the hosted trix index is not ` +
        `answering. List read:\n${listed}`,
    ]
  }
}

// Everything the search page claims is a state you get to by typing, and two of
// the three are *absences* — a search that resolves nothing, a search that
// resolves several things and goes nowhere. A census at rest cannot tell any of
// them from a page whose index URL 404s, which is the failure this is really
// here for: the trix files are hosted rather than in this repo, so the demo can
// stop working without a line of it changing.
//
// Exact text match on the button — a substring match would find `BRCA1P1` for
// a click aimed at `BRCA1`, which is a different one of the four paths.
async function searchByNameResolvesNames(page) {
  const out = []

  const clickButton = async label =>
    page.evaluate(t => {
      const el = [
        ...(document
          .querySelector('#search-by-name')
          ?.querySelectorAll('button') ?? []),
      ].find(e => e.innerText.trim() === t)
      el?.click()
      return !!el
    }, label)

  const pickerShown = () =>
    page.evaluate(
      () => !!document.querySelector('[data-testid="search-picker"]'),
    )

  // `BRC` and not `TP53`: TP53 prefixes twenty features and is exactly one of
  // them, so the exact pass wins and it navigates. BRC has several prefix
  // matches and no exact one, so the view leaves the choice to the page.
  if (await clickButton('BRC')) {
    try {
      await page.waitForFunction(
        () => !!document.querySelector('[data-testid="search-picker"]'),
        { timeout: 30000 },
      )
      const picked = await page.evaluate(() => {
        const row = document.querySelector(
          '[data-testid="search-picker"] li button',
        )
        row?.click()
        return !!row
      })
      if (!picked) {
        throw new Error('the BRC picker listed no rows')
      }
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="search-picker"]'),
        { timeout: 30000 },
      )
      const failed = await page.evaluate(
        () => !!document.querySelector('[data-testid="embed-notification"]'),
      )
      if (failed) {
        out.push('picking a BRC hit left an error notification')
      }
    } catch {
      out.push(
        'searching the ambiguous name BRC raised no picker, or picking a hit ' +
          'left it open — either navToLocString stopped raising ' +
          'view.searchPicker, or the index stopped returning more than one ' +
          'non-exact hit for it',
      )
    }
  } else {
    out.push('no exact "BRC" button')
  }

  // TP53 is ambiguous by prefix and still must not ask. Losing the exact-first
  // pass would raise the picker.
  if (await clickButton('TP53')) {
    try {
      await page.waitForFunction(
        () =>
          /^(chr)?17:7,\d{3},/.test(
            document.querySelector(
              '#search-by-name input[aria-label="Location"]',
            )?.value,
          ) || !!document.querySelector('[data-testid="search-picker"]'),
        { timeout: 30000 },
      )
    } catch {
      const value = await page.evaluate(
        () =>
          document.querySelector('#search-by-name input[aria-label="Location"]')
            ?.value,
      )
      out.push(
        `searching TP53 neither navigated to chr17:7 Mb nor asked; the box reads "${value}"`,
      )
    }
    if (await pickerShown()) {
      out.push(
        'searching TP53 raised a picker — the exact pass no longer runs ' +
          'before the prefix one, so a gene that prefixes its own relatives ' +
          'now asks instead of navigating',
      )
    }
  } else {
    out.push('no exact "TP53" button')
  }

  // And the other absence: a plain word with no hits is an ordinary miss,
  // which NavButton reports as a warning naming the term, not an error.
  if (await clickButton('zzzznotagene')) {
    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector('#search-by-name [data-testid="embed-notification"]')
            ?.innerText.includes('No results found for "zzzznotagene"'),
        { timeout: 30000 },
      )
      const role = await page.evaluate(() =>
        document
          .querySelector('#search-by-name [data-testid="embed-notification"]')
          ?.getAttribute('role'),
      )
      if (role !== 'status') {
        out.push(
          `the zzzznotagene miss drew as role="${role}" — NavButton is ` +
            'reporting an ordinary miss as an error again',
        )
      }
    } catch {
      out.push(
        'a search for zzzznotagene drew no "No results found" notification — ' +
          'SearchResultsNotFoundError is no longer reaching the page',
      )
    }
  } else {
    out.push('no exact "zzzznotagene" button')
  }

  return out
}

const PAGE_CHECKS = {
  'scalebar-and-gridlines': dragToZoomFramesTheSpan,
  'search-results': searchResultsListsHits,
  'search-by-name': searchByNameResolvesNames,
  'color-and-group-by-a-field': page =>
    placedKeyNamesItsRows(page, 'protein_coding'),
  'gene-lanes': page => placedKeyNamesItsRows(page, 'atpA'),
  'plot-from-json': page => placedKeyNamesItsRows(page, 'AluY'),
  'table-of-calls': aTableRowMovesTheView,
  'track-settings': legendIsPlainAndAboveTheSeams,
  'local-files': localFileOpensAsATrack,
  'view-loading-and-errors': viewStatusStatesAreDrawn,
  'session-in-url': checkSessionUrlRoundTrip,
}

// '' first: the landing page runs a live demo, so it gets the same census as
// any example page rather than being the one page nothing loads
const allSlugs = ['', ...pages.filter(e => !e.skipSmoke).map(e => e.slug)]
// `node scripts/smoke.mjs <slug>...` smokes just those pages
const only = process.argv.slice(2)
const slugs = only.length ? allSlugs.filter(s => only.includes(s)) : allSlugs

const orphanChecks = Object.keys(PAGE_CHECKS).filter(s => !allSlugs.includes(s))
if (orphanChecks.length) {
  console.error(
    `PAGE_CHECKS names page(s) the smoke does not visit: ${orphanChecks.join(', ')}`,
  )
  process.exit(1)
}

const failures = await smokeExamplesSite({
  distDir: path.join(here, '..', 'dist'),
  base: config.base,
  slugs,
  // The one page that passes `makeWorkerInstance`. Every other demo here runs
  // main-thread RPC, so this slug is the site's only guard on the Rollup
  // circular-dependency TDZ that webpack tolerates and Vite does not — and the
  // page's own claim is that a worker spawns, which loading it cannot show.
  workerSlug: 'web-worker',
  recordFromLoad: recordMuiFromLoad,
  // The console errors on this site that are a page working rather than
  // failing: `view-loading-and-errors` points one radio at an assembly whose
  // sequence file does not exist and another at a hub genome that does not,
  // and `viewStatusStatesAreDrawn` below clicks both, while
  // `track-loading-and-errors` carries a "track that fails to load" so its
  // bring-your-own error overlay has something to draw. Both named down to the
  // URL on purpose — a filter matching "404" would waive the ordinary
  // broken-data-link regression they look exactly like, on every page.
  allowedConsoleError: (text, slug) =>
    (slug === 'view-loading-and-errors' &&
      (text.includes('does-not-exist.2bit') ||
        text.includes('hub "not-a-genome" not found'))) ||
    (slug === 'track-loading-and-errors' && text.includes('does-not-exist.bw')),
  allowedUnsettled: (text, slug) =>
    slug === 'track-loading-and-errors' &&
    text ===
      'display(s) showing an error: wiggle-display (hg38_broken-LinearWiggleDisplay) is error',
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
    // they style themselves with CSS system colors, which is the thing that
    // silently stops tracking the page when the theme plumbing is wrong.
    ...(await checkTextContrast(page)),
    ...(await clicksReachTheTrack(page)),
    ...(await everyDisplayIsInAnOverlaySlot(page)),
    // last: a page's own check may add displays or replace the engine
    ...(await (PAGE_CHECKS[slug]?.(page) ?? [])),
  ],
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
