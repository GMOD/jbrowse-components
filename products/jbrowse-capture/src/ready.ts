import {
  describePendingDisplays,
  hasPaintContract,
  pendingDisplayStates,
  readInstrumentation,
  readSessionSummary,
  waitForSession,
} from './sessionGate.ts'
import {
  delay,
  hasAppReadyMarker,
  waitForAppReady,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
  waitForQuietPeriod,
  waitForViewPhases,
} from './waits.ts'

import type {
  Instrumentation,
  PendingDisplay,
  SessionExpectations,
} from './sessionGate.ts'
import type { Page } from 'puppeteer'

// The whole ready chain, in a module that touches puppeteer only through its
// types — capture.ts holds the runtime import (launching a browser), which is
// what keeps the chain callable under jest against a stubbed Page.

// A build with no per-display paint attributes gives no signal between "the
// overlay cleared" and "the canvas has pixels on it", so the only thing left is
// to wait. Sized from the measured gap on jbrowse.org/code/jb2/latest between
// the overlay clearing and the tracks being fully drawn.
const LEGACY_PAINT_SETTLE_MS = 1500
// ...and the gap at the OTHER end, which is the one that lands a capture on an
// app that has drawn nothing at all. Measured on the same instance with two
// remote tracks: the session gate is satisfied at ~2.5s, and the loading overlay
// — the only remaining signal there — does not go up until ~3.5s. An
// instrumented build has no such window: `data-display-phase` appears in the
// same frame as the display it belongs to.
//
// So on an uninstrumented build the app has to be seen to START working, and
// then hold still, before it counts as finished. The window is how long the
// first indicator gets to appear before "nothing to wait for" is the better
// reading; the quiet is how long the idle then has to hold.
const LEGACY_BUSY_WINDOW_MS = 4000
const LEGACY_QUIET_MS = 2000

export interface ReadyOptions extends SessionExpectations {
  /** Budget for each individual wait stage. */
  timeout?: number
  /**
   * Also wait out the app's own busy reports — adapter "Downloading…" status
   * text, which can outlive the loading overlay when a track streams a large
   * remote file, and any "Loading…/Rendering…" label still on screen. One
   * predicate answers both. Only consulted on a build without the app-ready
   * marker; the marker's `ready` already means no display is fetching.
   */
  waitForDownloads?: boolean
  /** Extra settle after everything reports done, for animations and tooltips. */
  settleMs?: number
  /**
   * Skip the session gate. Only for a page that is not jbrowse-web and so
   * publishes no `window.JBrowseSession` — an embedded component, say. You lose
   * the only check that the data you asked for is the data on screen, and the
   * marker and instrumentation reads then race the boot, so the chain leans on
   * the seen-busy-then-quiet gate instead of the attributes.
   */
  expectSession?: boolean
  /**
   * Return the report instead of throwing when a wait stage times out. For
   * capturing a page that is deliberately mid-load, or accepting a known-slow
   * one. The unsettled stages are still listed in the report either way.
   */
  allowUnsettled?: boolean
}

export interface ReadyReport {
  /** Displays still reporting unpainted at the end of the wait. */
  pending: string[]
  /**
   * The same displays with the phase each one publishes, which is what
   * separates a slow fetch from a display that says it finished without
   * painting. Empty whenever `pending` is.
   */
  pendingStates: PendingDisplay[]
  /**
   * Whether every display's paint state was actually measurable — false when
   * tracks are open but the build publishes no `data-display-drawn`. With this
   * false, an empty `pending` means "cannot tell", not "all done".
   */
  paintContract: boolean
  /** Wait stages that hit their timeout instead of being satisfied. */
  unsettled: string[]
  /**
   * Which readiness attributes the build published, read once the session was
   * up. Every `false` here is a wait that could not fail rather than one that
   * passed, and the chain compensates for it — see LEGACY_QUIET_MS.
   */
  instrumentation: Instrumentation
  /**
   * Whether the page published `[data-app-phase]`, the one positive readiness
   * selector. True means the wait was that selector and nothing else; false
   * means the build predates it and the fallback chain ran.
   */
  appMarker: boolean
}

/**
 * Wait until a JBrowse page has finished loading AND finished drawing.
 *
 * One positive gate, then the negative ones. The order is the whole point: the
 * DOM waits all pass on a page that has not started yet, so without the session
 * gate in front the chain returns in under a second (see sessionGate.ts). After
 * it, each stage is only meaningful once the previous has passed — a view still
 * resolving its assembly has mounted no displays, and a display that has mounted
 * but not fetched has nothing to be drawn yet.
 */
export async function waitForJBrowseReady(
  page: Page,
  {
    timeout = 60000,
    waitForDownloads = true,
    settleMs = 0,
    expectSession = true,
    assembly,
    trackIds,
    allowUnsettled = false,
  }: ReadyOptions = {},
): Promise<ReadyReport> {
  const unsettled: string[] = []
  const stage = async (name: string, work: Promise<boolean>) => {
    if (!(await work)) {
      unsettled.push(name)
    }
  }
  // The two hard waits reject with puppeteer's own `Waiting failed: Nms
  // exceeded`, which names neither the stage nor the selector — the whole
  // failure mode this module exists to avoid, arriving as an error message
  // instead of as a blank image. Say which gate it was and what to do.
  const required = async <T>(name: string, work: Promise<T>): Promise<T> => {
    try {
      return await work
    } catch {
      throw new Error(
        `gave up waiting after ${timeout}ms: ${name}. Raise the timeout if the ` +
          'page is merely slow; if it never finishes, open the same URL in a ' +
          'browser — this gate has no content to fall through to.',
      )
    }
  }

  // 0. the session exists and holds what was asked for. Positive, and throws.
  if (expectSession) {
    await waitForSession(page, { assembly, trackIds, timeout })
  }
  // 1. THE WHOLE ANSWER, on any build that has it: the session renders
  //    `[data-app-phase="ready"]` when no view is resolving an assembly and no
  //    display is fetching. It is positive, so unlike everything below it
  //    cannot be satisfied by an app that has not started, and there is nothing
  //    to assemble — wait for the selector and stop.
  //
  //    Everything after this point is the fallback for a deployment older than
  //    the marker, and can be deleted the day the oldest supported build has
  //    it.
  if (await hasAppReadyMarker(page)) {
    const ready = await waitForAppReady(page, { timeout })
    if (!ready) {
      unsettled.push('the app never reported itself ready')
    }
    // One thing the marker does not answer, so this stage stays even here: the
    // marker is about WORK, and a display whose fetch failed is not working. It
    // reads `ready` over an error banner, which is a correct answer to a
    // different question than a capture is asking. `data-display-drawn` is the
    // stricter gate — the two comparative canvases publish it from `settled`,
    // which holds an error open deliberately so a golden regenerated during an
    // outage fails here instead of absorbing the banner as expected output.
    // Ordered after the marker rather than instead of it, which is what makes an
    // absence meaningful (see waitForDisplaysDone), and free on a page that has
    // no such canvas. Skipped when the marker itself timed out: the paint wait
    // would spend a second full timeout on a page already known unsettled, and
    // the census below reports the unpainted displays either way.
    if (ready) {
      await stage(
        'a display never reported its first paint',
        waitForDisplaysDone(page, timeout),
      )
    }
    if (settleMs > 0) {
      await delay(settleMs)
    }
    const pendingStates = await pendingDisplayStates(page)
    const report = {
      pending: pendingStates.map(d => d.name),
      pendingStates,
      paintContract: await hasPaintContract(page),
      unsettled,
      instrumentation: await readInstrumentation(page),
      appMarker: true,
    }
    if (!allowUnsettled && unsettled.length > 0) {
      throw new Error(unsettledMessage(timeout, unsettled, pendingStates))
    }
    return report
  }

  // 1b. what an older build can be asked instead. On one that publishes none of
  //     these, the stages below are not gates at all: they are assertions about
  //     absent attributes that no page can fail.
  const instrumentation = await readInstrumentation(page)
  const instrumented =
    instrumentation.displayPhase || instrumentation.displayDrawn
  // A page with no tracks open has nothing to load, so the quiet gate below
  // would be a fixed sleep for an import form or a menu shot. No summary at all
  // — expectSession: false, where these reads race the boot — is the opposite
  // case: nothing has been ruled out, and reading "unknown" as "no tracks" here
  // is what let the whole chain pass over an app that had not started, since
  // every stage below the gate is an absence an empty page satisfies.
  const summary = await readSessionSummary(page)
  const needsQuietGate =
    !instrumented && (summary === undefined || summary.trackIds.length > 0)

  // 2. the view has an assembly and its React component has arrived. Also not
  //    best-effort: a view stuck here has no content to fall through to.
  await required(
    'a view never left its loading phase (still resolving its assembly, or its ' +
      'lazily-imported component never arrived)',
    waitForViewPhases(page, timeout),
  )
  // 3. no track is still fetching: an overlay that never clears is a fetch
  //    that never finished, with nothing behind it, so this one throws too.
  await required(
    'the loading overlay never cleared (a track fetch never finished)',
    waitForLoadingComplete(page, { timeout }),
  )
  await stage(
    'a display was still in its loading phase',
    waitForDisplayPhases(page, timeout),
  )
  // 4. no display is still pending its first paint
  await stage(
    'a display never reported its first paint',
    waitForDisplaysDone(page, timeout),
  )
  // 5. nothing still reports itself busy: adapter "Downloading…" status on the
  //    session model, which can outlive the overlay, and the visible
  //    "Loading…/Rendering…" labels of the views that publish no phase
  //    attribute. One predicate answers both, so it is one stage — it used to
  //    run twice, once as waitForLoadingComplete's download half and once
  //    under its own name, and a slow page paid the same timeout for each.
  if (waitForDownloads) {
    await stage(
      'a track was still downloading, or a "Loading…/Rendering…" label was ' +
        'still on screen',
      waitForQuiescent(page, { timeout }),
    )
  }
  // 6. and on a build that answered none of the above, the one gate that does
  //    not depend on an attribute existing: the app has to hold still. Every
  //    stage before this one passed the moment it was asked, so without it the
  //    chain returns while the first fetch is still being set up.
  if (needsQuietGate) {
    await stage(
      'the app never went quiet for ' +
        `${LEGACY_QUIET_MS}ms (this build publishes no readiness attributes, ` +
        'so being seen to work and then stop is the only finished signal there ' +
        'is)',
      waitForQuietPeriod(page, {
        quietMs: LEGACY_QUIET_MS,
        busyWindowMs: LEGACY_BUSY_WINDOW_MS,
        timeout,
      }),
    )
  }

  const paintContract = await hasPaintContract(page)
  if (!paintContract) {
    await delay(LEGACY_PAINT_SETTLE_MS)
  }
  if (settleMs > 0) {
    await delay(settleMs)
  }
  const pendingStates = await pendingDisplayStates(page)
  const report = {
    pending: pendingStates.map(d => d.name),
    pendingStates,
    paintContract,
    unsettled,
    instrumentation,
    appMarker: false,
  }
  if (!allowUnsettled && unsettled.length > 0) {
    // Throwing is the point. Each of these stages swallows its own timeout so a
    // slow page is not failed for being slow, which historically meant the run
    // ended with an image and an exit code of 0 whether it had settled or not.
    // A caller that genuinely wants the frame anyway asks for it by name.
    throw new Error(unsettledMessage(timeout, unsettled, pendingStates))
  }
  return report
}

/**
 * What a timed-out wait says. The stage names alone were the whole message, and
 * they name the QUESTION rather than the answer — "a display never reported its
 * first paint" reads identically for a slow fetch, a failed one and a display
 * that never had a canvas to paint. Appending the census answers it, and the
 * `ready` case is the one that most changes what a reader does next: a longer
 * timeout is the fix for `loading` and never the fix for that.
 */
function unsettledMessage(
  timeout: number,
  unsettled: string[],
  pending: PendingDisplay[],
) {
  return (
    `gave up waiting after ${timeout}ms: ${unsettled.join('; ')}. ${
      pending.length > 0
        ? `Still unpainted: ${describePendingDisplays(pending)}. `
        : ''
    }Raise the timeout, or pass allowUnsettled (--allowUnsettled) to ` +
    `capture the frame as it stands.`
  )
}
