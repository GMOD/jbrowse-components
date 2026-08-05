// Getting a page to the state a figure is supposed to show, and knowing when it
// is there.
//
// The waits themselves live in @jbrowse/browser-test-utils (shared with the
// browser-test suites and the desktop harness); what is here is the ORDER they
// have to run in, which is the part that took the bugs to learn.
import {
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'

import { textSelector, waitForVisible } from './actions.ts'
import { debugDump, markPageAlive } from './screenshot-asserts.ts'
import {
  DEFAULT_READY_TIMEOUT_MS,
  DEFAULT_SETTLE_MS,
} from './screenshot-options.ts'

import type {
  BrowserScreenshotSpec,
  EmbeddedSpec,
  SessionUrlSpec,
} from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

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
// FETCH FIRST, THEN PAINT. `-done` is canvasDrawn (first paint), which a display
// can reach on an empty canvas while its fetch is still in flight, so waiting on
// it *before* the phase gate proves nothing about content; waiting after it
// means every display has both finished fetching and drawn what it fetched.
// That ordering is what lets a spec's `readySelector` stay a single
// `[data-testid="…-done"]` instead of a hand-written `body:has(…):not(:has(…))`
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

export async function captureUrl(
  page: Page,
  spec: SessionUrlSpec,
  port: number,
) {
  const fullUrl = spec.url.startsWith('http')
    ? spec.url
    : `http://localhost:${port}/${spec.url}`
  await page.goto(fullUrl, {
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
