import { holdTrue } from './poll.ts'
import {
  describePendingDisplays,
  pendingDisplayStatesInPage,
  tooLargeDisplaysInPage,
} from './sessionGate.ts'

import type { ElementHandle, Page } from 'puppeteer'

// Every best-effort wait below runs through this. They swallow their own timeout
// on purpose — a slow-but-finishing page should not be failed for being slow,
// and a display in a terminal state publishes no attribute to wait on at all —
// but swallowing it in silence is what makes a blank capture unattributable:
// "everything settled" and "we gave up" become the same `void`. So the outcome
// comes back as a boolean instead. Callers that only `await` are unaffected;
// callers that care (see waitForJBrowseReady) can report or fail on it.
async function settled(work: Promise<unknown>): Promise<boolean> {
  try {
    await work
    return true
  } catch {
    return false
  }
}

export const LOADING_OVERLAY = '[data-testid="loading-overlay"]'

/**
 * The whole readiness contract, in one selector.
 *
 * `AppReadyMarker` renders it from the session: it reads `ready` when no view
 * is resolving an assembly and no display is fetching, and `loading` whenever
 * one is. Waiting for it is the entire job — everything else in this module is
 * either a narrower question (has THIS display painted) or a fallback for a
 * deployment too old to publish it.
 *
 * It is POSITIVE, which is the property that matters. Every other signal here
 * is an absence, and an absence is equally true of an app that has not started:
 * measured on a two-track session, the gap between "the session holds the
 * tracks" and "the first loading indicator appears" is about a second, and a
 * capture taken in it is a picture of an empty browser.
 */
export const APP_READY = '[data-app-phase="ready"]'

/**
 * A display drawing a transition between two settled pictures: canvas's row
 * morph, a multi-way lane re-aligning. The app is finished working and every
 * display reads `ready`, so neither the marker nor the phase can say so; the
 * display publishes it itself, and a frame taken while it reads `true` is a
 * picture no settled state ever shows.
 */
export const ANIMATING_DISPLAYS = '[data-display-animating="true"]'

/**
 * How long `ready` has to HOLD before an interaction's work counts as finished.
 *
 * Above the ~600ms `FetchVisibleRegions` debounce, which is the whole reason
 * this is a hold rather than a single read: a click that dirties the viewport
 * leaves the app reading `ready` until that autorun fires, so one sample taken
 * in the gap reports the pre-click frame as finished.
 */
const APP_SETTLED_HOLD_MS = 1000

/**
 * Wait until the loading overlay is gone, and with `waitForDownloads` until
 * nothing else reports itself busy either — a remote fetch can outlive the
 * overlay, so a capture taken on the overlay alone catches a half-loaded track.
 *
 * NOT best-effort: an overlay that never clears means a fetch that never
 * finished, and there is no content behind it to fall through to.
 */
export async function waitForLoadingComplete(
  page: Page,
  {
    timeout = 30000,
    waitForDownloads = false,
  }: { timeout?: number; waitForDownloads?: boolean } = {},
): Promise<boolean> {
  await page.waitForFunction(
    (selector: string) => document.querySelector(selector) === null,
    { timeout, polling: 'mutation' },
    LOADING_OVERLAY,
  )
  // `quietMs: 0` because this is the "nothing is in flight right now" question;
  // the one that needs the idle to hold is waitForQuietPeriod's own caller.
  return waitForDownloads
    ? waitForQuietPeriod(page, { quietMs: 0, timeout })
    : true
}

/**
 * Wait until nothing on the page is in flight.
 *
 * Every signal it reads is one the app publishes deliberately — the loading
 * overlay, `data-busy`, the display and view phases, and each display's own
 * status message on the session model. See `isPageBusyInPage`.
 *
 * It used to scan rendered text for /^(loading|rendering|computing)/ and resolve
 * `getComputedStyle` on each match to decide whether it was on screen. That is a
 * heuristic over a rendering: it broke on a reworded or translated message, it
 * needed the visibility check only because the loading overlay keeps the word
 * "Loading" in the DOM at `opacity: 0`, and an unset opacity parses to zero
 * outside a full layout engine, which reads every ordinary element as hidden. A
 * component that wants to be waited for now says so with an attribute.
 *
 * Best-effort: a view genuinely stuck loading would otherwise burn the whole
 * timeout, so this reports false rather than throwing and the caller decides.
 */
export function waitForQuiescent(
  page: Page,
  { timeout = 30000 }: { timeout?: number } = {},
): Promise<boolean> {
  return waitForQuietPeriod(page, { quietMs: 0, timeout })
}

// "Every display has painted" = no display is still reporting
// `data-display-drawn="false"`. DisplayChrome publishes that directly, so this
// no longer has to infer paint state from the *shape* of a test id: it used to
// be a three-way union — `display-<displayId>` not ending in `-done`, plus
// anything ending in `-display`, plus synteny — because the id both identified
// the display and encoded its paint state by mutating, and the bases came in
// three shapes depending on whether a second wrapper element was involved. One
// element per display and one stable attribute retire all of that — including
// for the two non-LGV views, which have no chrome but publish the same attribute
// through `RenderCanvas`. That closed a real hole: the old list named
// `synteny_canvas` explicitly and simply forgot dotplot, so an unpainted dotplot
// counted as finished here and a capture could land on it blank.
//
// Exported so a caller can re-check the post-condition after the wait and say
// whether it actually settled or merely timed out. `waitForDisplaysDone` (like
// its neighbours) swallows its own timeout on purpose, which leaves "every
// display painted" and "we gave up waiting" indistinguishable at the call site —
// and that ambiguity is what makes a blank capture unattributable.
export const PENDING_DISPLAYS = '[data-display-drawn="false"]'

/**
 * `page.waitForSelector`, with the display census in the timeout.
 *
 * The waits below are best-effort and hand their outcome back as a boolean, so
 * a caller can say what was still unsettled. A *selector* wait is the opposite
 * shape — it throws, and it runs FIRST, before any of them: a capture whose
 * display never paints dies here on puppeteer's `TimeoutError`, which names the
 * selector and nothing else, and the census that would have named the display
 * runs later or not at all.
 *
 * So the census runs on the way out. It is re-read from the DOM here rather
 * than taken off a handle the wait held: a handle to an element that has since
 * re-rendered throws `Node is detached from document`, which is how the first
 * attempt at this turned four diagnosable timeouts into nine opaque puppeteer
 * errors (reverted in 28c6ee6d90).
 *
 * What it reports is the phase, and that is the part a longer timeout cannot
 * substitute for: `loading` is a slow fetch, `error` is a display that has
 * finished badly and is showing a banner, and `ready` is a display claiming it
 * finished without drawing — a bug in the display rather than in the wait.
 *
 * A display showing "too much data" is not pending, and a wait on its body
 * can never resolve, so the census names those too.
 */
export async function waitForSelectorAttributed(
  page: Page,
  selector: string,
  timeoutMs: number,
): Promise<ElementHandle> {
  try {
    const handle = await page.waitForSelector(selector, { timeout: timeoutMs })
    if (!handle) {
      throw new Error(`element not found: ${selector}`)
    }
    return handle
  } catch (cause) {
    throw new Error(
      `${selector} did not appear within ${timeoutMs}ms — ${await describePendingDisplaysNow(page)}`,
      { cause },
    )
  }
}

/**
 * The census as one clause, for a message. Best-effort in its own right: a page
 * whose execution context is gone cannot be asked, and saying so is the answer.
 */
export async function describePendingDisplaysNow(page: Page) {
  try {
    const pending = await page.evaluate(pendingDisplayStatesInPage)
    const tooLarge = await page.evaluate(tooLargeDisplaysInPage)
    const found = [
      pending.length
        ? `${pending.length} display(s) had not painted: ${describePendingDisplays(pending)}`
        : undefined,
      tooLarge.length
        ? `${tooLarge.length} display(s) show "too much data" in place of their features: ${describePendingDisplays(tooLarge)}`
        : undefined,
    ].filter(Boolean)
    return found.length
      ? found.join('; ')
      : 'no display reported itself unpainted, so the selector was not on a display'
  } catch {
    return 'the page could not be queried afterwards (context gone)'
  }
}

// The composite selectors, so "this display type, painted" is written once.
//
// `data-testid` names the display TYPE and is stable; the readiness attributes
// are separate and orthogonal. That split is deliberate (ADR-065) and it is what
// makes `PENDING_DISPLAYS` above a single selector — but it does mean the
// everyday question, "has the pileup finished", is a conjunction rather than one
// attribute. Writing that conjunction out at each call site is what previously
// produced two suffix conventions and a `[data-testid$="-done"],
// [data-testid$="_done"]` union, so it is a function here instead.
//
// No `CSS.escape`: these are our own testids, fixed identifiers chosen in the
// display components, and the escape function does not exist in node (where
// these strings are built) nor in jsdom.
export const displayPainted = (testid: string) =>
  `[data-testid="${testid}"][data-display-drawn="true"]`

/**
 * The stronger one. `drawn` flips on FIRST paint — an empty canvas with the
 * fetch still in flight satisfies it — so a figure that must show *data* waits
 * on the phase instead.
 */
export const displaySettled = (testid: string) =>
  `[data-testid="${testid}"][data-display-phase="ready"]`

// Wait until no display is still pending its first paint AND could still reach
// it: a pending display publishing `loading`, or publishing no phase at all (a
// build older than the attribute), is still coming; a terminal phase is not. The
// two comparative canvases hold `drawn=false` open through `error` deliberately,
// so waiting on the attribute alone burns the whole timeout over an answer the
// census already has — waitForJBrowseReady takes that census straight after and
// reports whatever is left as unsettled.
//
// Keying on the *absence* of pending wrappers rather than counting done-vs-total
// is what lets a page with no canvas displays — an import form, a menu or widget
// figure — resolve immediately instead of paying the full timeout as a hidden
// fixed sleep, and what makes a page whose displays finish at different times
// wait for the last one; the previous "any element ends in -done" fallback
// returned as soon as the *first* of several tracks painted.
//
// Absence is only meaningful once the views have mounted (a track's display
// wrapper mounts with its TrackRenderingContainer), so call this after the
// readySelector / loading-overlay gates, not straight off a navigation.
export function waitForDisplaysDone(
  page: Page,
  timeoutMs: number,
): Promise<boolean> {
  return settled(
    page.waitForFunction(
      (selector: string) =>
        [...document.querySelectorAll<HTMLElement>(selector)].every(
          el =>
            el.dataset.displayPhase !== undefined &&
            el.dataset.displayPhase !== 'loading',
        ),
      { timeout: timeoutMs, polling: 'mutation' },
      PENDING_DISPLAYS,
    ),
  )
}

// Wait until no display is in its `loading` phase.
//
// This is the signal the other waits here only approximate. `waitForDisplaysDone`
// keys on canvasDrawn (FIRST paint — flips on an empty canvas with the fetch
// still running), `waitForLoadingComplete` on an overlay that a debounced fetch
// may not have raised yet, and `waitForQuiescent` on status *text*. DisplayChrome
// publishes `data-display-phase` from the model's own mutually-exclusive
// DisplayPhase, whose `loading` term covers the entire fetch, so "nothing is
// loading" is a direct read rather than an inference.
//
// Terminal phases (`tooLarge`, `renderError`) resolve immediately here, since
// they are finished, not pending. The caller's census reports them.
//
// Best-effort like its neighbours: a display that never leaves `loading` should
// fail loudly through that settled check, with the frame to look at, rather than
// as an opaque timeout here.
export function waitForDisplayPhases(
  page: Page,
  timeoutMs: number,
): Promise<boolean> {
  return settled(
    page.waitForFunction(
      () => document.querySelector('[data-display-phase="loading"]') === null,
      { timeout: timeoutMs, polling: 'mutation' },
    ),
  )
}

/**
 * A view whose MODEL is initialized but whose lazily-imported React component
 * has not arrived: ViewWrapper's Suspense spinner. The app marker cannot see
 * it, since the model it reads is finished, so a view clicked into existence
 * reads `ready` for as long as its chunk takes to load.
 */
const VIEW_COMPONENT_PENDING = '[data-view-component-pending]'

// The view-level counterpart: ViewContainer publishes `data-view-phase` from the
// view model's own phase, and `loading` means the view is still waiting on its
// assembly (or on init's navigation) and has mounted no displays at all. Every
// display-level wait above is silent in that state — there is nothing to be
// loading yet — so a capture taken then lands on a bare spinner.
//
// NOT best-effort, unlike its neighbours: a view that never leaves `loading` has
// no content to fall through to, so the timeout IS the diagnosis and the caller
// should surface it.
export function waitForViewPhases(page: Page, timeoutMs: number) {
  return page.waitForFunction(
    (pending: string) =>
      document.querySelector('[data-view-phase="loading"]') === null &&
      document.querySelector(pending) === null,
    { timeout: timeoutMs, polling: 'mutation' },
    VIEW_COMPONENT_PENDING,
  )
}

/**
 * Everything the app publishes to say it is working, as one selector.
 *
 * All four are attributes a component sets deliberately, which is the whole
 * point: the alternative — scanning rendered text for /^loading/ and resolving
 * `getComputedStyle` to decide whether each match is on screen — makes a
 * reworded message, a translation or an opacity animation change the answer.
 *
 *   `loading-overlay`      the view-level scrim, present in every build
 *   `data-busy`            LoadingEllipses, which is what the app renders
 *                          wherever it tells a user it is working
 *   `data-display-phase`   one display's own fetch, newer builds
 *   `data-view-phase`      a view still resolving its assembly, newer builds
 *   `data-display-animating`  a display drawing a morph, newer builds
 */
export const BUSY_SELECTOR = [
  LOADING_OVERLAY,
  '[data-busy="true"]',
  '[data-display-phase="loading"]',
  '[data-view-phase="loading"]',
  ANIMATING_DISPLAYS,
].join(', ')

/**
 * Is the app doing anything right now?
 *
 * Serialized into the page, so it declares everything it uses and takes
 * `BUSY_SELECTOR` as an argument rather than importing it. Every signal is a
 * data attribute a component sets deliberately, so restyling or rewording the
 * UI cannot move the answer.
 *
 * It used to also walk `window.JBrowseSession` for each display's own status
 * message — the only PER-DISPLAY signal a build with no readiness attributes
 * had. That walk was a duck-typed copy of the session gate's, drifted onto a
 * different container spelling (ADR-103), and it went with the builds that
 * needed it: `data-display-phase="loading"` covers the same fetch directly.
 *
 * Exported so a test can call the real function rather than a copy of it.
 */
export function isPageBusyInPage(busySelector: string): boolean {
  return document.querySelector(busySelector) !== null
}

/**
 * Wait until the app has been idle for an unbroken stretch.
 *
 * Idle answers "is it working NOW"; a page is finished only if it stays that
 * way, because a track that ends one fetch and starts the next is momentarily
 * idle and a single-sample read takes that gap for the end. Requiring the idle
 * to HOLD closes it.
 *
 * NOT a readiness gate on its own — idle is an absence, equally true of an app
 * that has not started. `waitForAppSettled` is the gate; this is the tool for
 * "nothing is in flight right now", which is what a probe or a benchmark wants
 * between two measured actions.
 *
 * Returns false on timeout rather than throwing, like its neighbours.
 */
export function waitForQuietPeriod(
  page: Page,
  {
    quietMs = 1500,
    timeout = 30000,
    pollMs = 250,
  }: { quietMs?: number; timeout?: number; pollMs?: number } = {},
): Promise<boolean> {
  // a page that navigates or closes under us fails the evaluate, which reads
  // as busy and leaves the deadline to decide
  return holdTrue(
    () =>
      page.evaluate(isPageBusyInPage, BUSY_SELECTOR).then(
        busy => !busy,
        () => false,
      ),
    { holdMs: quietMs, timeout, pollMs },
  )
}

/**
 * Wait for the FIRST frame the app says it has finished.
 *
 * `[data-app-phase="ready"]` is rendered by the session itself, so it cannot be
 * satisfied before the app exists — but one frame of it is not the answer on its
 * own: a display reads `ready` in the gap between one fetch finishing and the
 * debounced next one starting. `waitForAppSettled` requires it to HOLD, and is
 * what both the chain here and `jb.waitReady` use.
 *
 * Returns false if it never appears within the timeout.
 */
export function waitForAppReady(
  page: Page,
  { timeout = 30000 }: { timeout?: number } = {},
): Promise<boolean> {
  return settled(page.waitForSelector(APP_READY, { timeout, visible: false }))
}

function hasAppReadyMarker(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.querySelector('[data-app-phase]') !== null,
  )
}

/**
 * Wait out work an INTERACTION started: `ready`, and still ready a beat later.
 *
 * The gate wherever `waitForAppReady` alone is not one, which is everywhere the
 * app is working. After an interaction the app is already `ready` — it was
 * finished a moment ago — and stays that way until the click's work registers,
 * so a single read returns instantly, on the pre-click frame; during a load it
 * reads `ready` in the gap between one fetch finishing and the debounced next
 * one starting, and a single read takes that gap for the end.
 *
 * What it replaces is a fixed sleep, which is wrong in both directions and only
 * ever caught in one: too short captures the work in progress, and the figure it
 * produces looks finished, while too long is dead time on every run.
 *
 * **Not "seen busy, then ready"**, which is the obvious shape and was built and
 * measured first. Waiting for `loading` to appear before accepting `ready` needs
 * a cap, since an interaction that only opened a menu never makes the app busy at
 * all — and on the figure spec it was measured against
 * (`search_feature_highlight`) the app was never seen busy either, because that
 * spec's own selector wait had already outlasted the redraw. The busy window then
 * ran to its 2s cap having watched nothing, costing more than the 1.2s sleep it
 * replaced. Requiring the idle to HOLD costs the hold and no more, and catches
 * the same late-starting work.
 *
 * The hold also requires no view body to be waiting on its lazy component and
 * no display to be animating, neither of which the marker can see.
 *
 * Throws on a build too old for the marker rather than falling back — see the
 * body.
 */
export async function waitForAppSettled(
  page: Page,
  {
    timeout = 30000,
    holdMs = APP_SETTLED_HOLD_MS,
    pollMs = 250,
  }: { timeout?: number; holdMs?: number; pollMs?: number } = {},
): Promise<boolean> {
  if (!(await hasAppReadyMarker(page))) {
    // Throws rather than falling back to the quiet period. The fallback was a
    // no-op that reported success on a build with no attributes at all, which
    // is how a spec that dropped its fixed sleep for this ended up capturing
    // the frame the sleep was there to avoid. A build without the marker needs
    // a newer build, not a wait that cannot fail.
    throw new Error(
      'this page publishes no [data-app-phase], so there is nothing positive ' +
        'to wait for — every other readiness attribute is an absence an app ' +
        'that has not started also satisfies.',
    )
  }
  return holdTrue(
    () =>
      page
        .evaluate(
          (ready, pending, animating) =>
            document.querySelector(ready) !== null &&
            document.querySelector(pending) === null &&
            document.querySelector(animating) === null,
          APP_READY,
          VIEW_COMPONENT_PENDING,
          ANIMATING_DISPLAYS,
        )
        .catch(() => false),
    { holdMs, timeout, pollMs },
  )
}
