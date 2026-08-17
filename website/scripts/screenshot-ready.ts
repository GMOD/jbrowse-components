// Getting a page to the state a figure is supposed to show, and knowing when it
// is there.
//
// The waits themselves live in @jbrowse/browser-test-utils (shared with the
// browser-test suites and the desktop harness); what is here is the ORDER they
// have to run in, which is the part that took the bugs to learn.
import {
  hasAppReadyMarker,
  readInstrumentation,
  waitForAppReady,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
  waitForQuietPeriod,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'

import { textSelector, waitForVisible } from './actions.ts'
import { debugDump, markPageAlive } from './screenshot-asserts.ts'

import type {
  BrowserScreenshotSpec,
  EmbeddedSpec,
  SessionUrlSpec,
} from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// The readiness stack's own two defaults. They live here rather than in
// screenshot-options.ts because importing that module PARSES process.argv and
// exits on `--help`, which its own header says nothing outside a screenshot run
// should trigger — and this module has a second caller now
// (generate-video.ts), whose CLI takes different flags and died on its own
// `--list` before it reached main().
//
// Maximum time to wait for canvas displays to signal paint-complete via their
// *-done testids. A timeout (proceed if it expires), not a fixed floor.
const DEFAULT_SETTLE_MS = 2500
// Default ceiling for the ready-selector / loading-overlay / quiescent waits.
// Slow remote-data specs raise it via spec.readyTimeout.
const DEFAULT_READY_TIMEOUT_MS = 30000
// How long an uninstrumented build has to hold still before it counts as
// finished.
//
// A spec whose url is absolute reaches jbrowse.org/code/jb2/latest, and the
// released build publishes none of `data-view-phase`, `data-display-phase` or
// `data-display-drawn` (measured 2026-08-17). Against that instance
// `waitForViewPhases` and both display waits below are assertions about
// attributes that do not exist — they pass the moment they are asked — and the
// loading overlay does not go up until a second AFTER the session reports its
// tracks open. So every gate in this file could be satisfied by an app that had
// drawn nothing, which is what a tour filmed there right-clicked into.
//
// Holding still is the one signal that does not depend on an attribute
// existing. Paid only on those targets; `@jbrowse/capture` carries the same
// constant for the same reason.
const LEGACY_BUSY_WINDOW_MS = 4000
const LEGACY_QUIET_MS = 2000

// The ceiling for every wait a spec is subject to. readyText is only the track
// label (present well before a slow remote BAM finishes), so a spec that says it
// needs longer gets that everywhere — the fixed default otherwise cut off slow
// whole-genome-alignment blocks mid-load and captured a "Loading" panel.
export function readyTimeoutOf(spec: BrowserScreenshotSpec) {
  return spec.readyTimeout ?? DEFAULT_READY_TIMEOUT_MS
}

// One round of the post-first-paint settle: nothing is drawing, no display is
// still in its `loading` phase, and every canvas display has painted. Each keys
// off a different signal, and none is sufficient alone — see the waits' own docs
// in @jbrowse/browser-test-utils.
//
// FETCH FIRST, THEN PAINT. `data-display-drawn` is canvasDrawn (first paint),
// which a display can reach on an empty canvas while its fetch is still in
// flight, so waiting on it *before* the phase gate proves nothing about content;
// waiting after it means every display has both finished fetching and drawn what
// it fetched. That ordering is what lets a spec's `readySelector` stay a single
// `displayPainted('…')` instead of a hand-written `body:has(…):not(:has(…))`
// puzzle enumerating each panel — the generic pair below already says "all of
// them, fetched and painted" for every display DisplayChrome wraps.
//
// The paint wait keeps its short `settleMs` bound, which is now the right size
// for it: it starts once nothing is fetching, so it is waiting out a repaint,
// not a download. Ordered the other way it expired mid-fetch on every slow
// figure and — being best-effort — was swallowed silently.
async function settlePass(page: Page, spec: BrowserScreenshotSpec) {
  await waitForQuiescent(page, { timeout: readyTimeoutOf(spec) })
  await waitForDisplayPhases(page, readyTimeoutOf(spec))
  await waitForDisplaysDone(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
}

// Wait out a spec's readiness signals before capture: its readyText/readySelector
// become visible, the loading overlay clears, any in-track "Loading…"/"Rendering…"
// indicator quiesces, and canvas displays signal paint-complete.
export async function waitForReady(
  page: Page,
  spec: SessionUrlSpec | EmbeddedSpec,
) {
  const readyTimeout = readyTimeoutOf(spec)
  const readySelectors = [
    spec.readyText ? textSelector(spec.readyText) : undefined,
    spec.readySelector,
  ].filter((s): s is string => s !== undefined)
  try {
    // first: while a view reads data-view-phase=loading it has mounted no
    // displays, so the spec's own ready selector and every display-level signal
    // below are all silent, and a capture would land on a bare spinner
    if (!spec.allowUnsettled) {
      await waitForViewPhases(page, readyTimeout)
    }
    for (const selector of readySelectors) {
      await waitForVisible(page, selector, { timeout: readyTimeout })
    }
    // the loading-overlay wait is the one that hard-fails on a view that never
    // finishes; quiescent/displays-done are best-effort by design
    await waitForLoadingComplete(page, {
      waitForDownloads: true,
      timeout: readyTimeout,
    })
    // ...and then the one selector that answers the whole question, on a build
    // that has it: the session renders `[data-app-phase="ready"]` when nothing
    // is loading, so it cannot be true before the app starts.
    if (await hasAppReadyMarker(page)) {
      await waitForAppReady(page, { timeout: readyTimeout })
    } else {
      // An older build publishes no phases at all, so every wait above passed
      // the moment it was asked. Watch it work instead: seen busy, then idle.
      const { displayPhase, displayDrawn } = await readInstrumentation(page)
      if (!displayPhase && !displayDrawn) {
        await waitForQuietPeriod(page, {
          quietMs: LEGACY_QUIET_MS,
          busyWindowMs: LEGACY_BUSY_WINDOW_MS,
          timeout: readyTimeout,
        })
      }
    }
  } catch (e) {
    await debugDump(page, spec.name)
    throw e
  }
  await settlePass(page, spec)
  // Belt and braces for the displays that publish no phase (non-LGV views, and
  // anything not routed through DisplayChrome): re-run while an overlay is still
  // up. Bounded, so a view that never finishes fails through assertRenderSettled
  // with a frame to look at instead of hanging here.
  for (let pass = 0; pass < 2; pass++) {
    const stillLoading = await page.evaluate(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length > 0,
    )
    if (!stillLoading) {
      break
    }
    await waitForLoadingComplete(page, {
      waitForDownloads: true,
      timeout: readyTimeout,
    })
    await settlePass(page, spec)
  }
}

/**
 * Pin a capture to WebGL. Every figure is rendered headless, headless Chrome is
 * SwiftShader, and `createGpuHal` steps over a software rasterizer — so without
 * this a regen silently redraws the whole corpus on Canvas2D, a real visual
 * change across every figure arriving as a side effect of a rendering decision.
 * Moving the corpus to another backend should be a deliberate edit here.
 *
 * **Applied at capture, never in the url builder.** `sessionSpec` builds these
 * same urls and has a second consumer — `gen-gallery-links.ts` bakes them into
 * the website gallery, where a pin would force WebGL on the very visitors the
 * ladder exists to route away from it. That is not hypothetical: it shipped, to
 * 251 links, and took two commits to undo.
 */
export function pinRenderer(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}renderer=webgl`
}

export async function captureUrl(
  page: Page,
  spec: SessionUrlSpec,
  port: number,
) {
  const fullUrl = spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
  await page.goto(pinRenderer(fullUrl), {
    waitUntil:
      spec.waitUntil ??
      (spec.url.startsWith('http') ? 'domcontentloaded' : 'networkidle0'),
    // networkidle0 can't be reached while a spec's data is still streaming, so a
    // fixed 60s here failed the heavy tcga specs as a *navigation* timeout —
    // nothing to do with the page being broken. A spec that already declares it
    // needs longer to be ready gets the same room for its navigation.
    timeout: Math.max(60000, spec.readyTimeout ?? 0),
  })

  await waitForReady(page, spec)
  await markPageAlive(page)
}
