import type { Page } from 'puppeteer'

// Fixed-duration sleep. Shared by the browser-test suites and the website
// screenshot generator so the helper isn't redefined per consumer.
export const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

// Wait until the LoadingOverlay test-id is gone. NOTE: the overlay keeps the
// literal text "Loading" in the DOM (hidden via opacity), so a text-based wait
// burns its full timeout — only the `loading-overlay` test-id count is a
// reliable signal. With `waitForDownloads`, also wait out adapter "Downloading…"
// status text, which can linger after the overlay clears (e.g. a remote BAM
// still fetching) so a capture doesn't catch a half-loaded track.
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
 * How long `ready` has to HOLD before an interaction's work counts as finished.
 *
 * Above the ~600ms `FetchVisibleRegions` debounce, which is the whole reason
 * this is a hold rather than a single read: a click that dirties the viewport
 * leaves the app reading `ready` until that autorun fires, so one sample taken
 * in the gap reports the pre-click frame as finished.
 */
const APP_SETTLED_HOLD_MS = 1000

export async function waitForLoadingComplete(
  page: Page,
  {
    timeout = 30000,
    waitForDownloads = false,
  }: { timeout?: number; waitForDownloads?: boolean } = {},
): Promise<boolean> {
  // NOT best-effort: an overlay that never clears means a fetch that never
  // finished, and there is no content behind it to fall through to.
  await page.waitForFunction(
    (selector: string) => document.querySelectorAll(selector).length === 0,
    { timeout },
    LOADING_OVERLAY,
  )
  // The download half asks the app what it is doing, through the attributes it
  // publishes and each display's own status on the session model. It used to be
  // `document.body.innerText.includes('Downloading')`, a string search over the
  // whole rendered page: it matched a track NAMED "Downloading…", it matched
  // documentation text, and it stopped matching the moment a message was
  // reworded or translated.
  //
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

/** One display, by its config's `displayId` rather than by type. */
export const displayById = (displayId: string) =>
  `[data-display-id="${displayId}"]`

// Wait until no display wrapper is still pending its first paint, or until the
// timeout elapses (proceed anyway — a display stuck in its too-large/error state
// renders no wrapper at all and never reports done).
//
// Keying on the *absence* of pending wrappers rather than counting done-vs-total
// matters twice over. A page with no canvas displays — an import form, a menu or
// widget figure — resolves immediately instead of burning the full timeout as a
// hidden fixed sleep. And a page whose displays finish at different times waits
// for the last one; the previous "any element ends in -done" fallback returned as
// soon as the *first* of several tracks painted.
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
      (selector: string) => document.querySelector(selector) === null,
      { timeout: timeoutMs },
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
// Terminal phases (`tooLarge`, `renderError`) replace the display subtree and
// publish no attribute, so they resolve immediately here — correct, since they
// are finished, not pending. They're caught as *content* by the caller's own
// settled check, not by this wait.
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
      { timeout: timeoutMs },
    ),
  )
}

// The view-level counterpart: ViewContainer publishes `data-view-phase` from the
// view model's own phase, and `loading` means the view is still waiting on its
// assembly (or on init's navigation) and has mounted no displays at all. Every
// display-level wait above is silent in that state — there is nothing to be
// loading yet — so a capture taken then lands on a bare spinner.
//
// The `data-view-component-pending` half is the case the phase attribute cannot
// report: a view whose MODEL is initialized but whose lazily-imported React
// component has not arrived, so ViewContainer publishes a non-loading phase over
// a body that is still ViewWrapper's Suspense spinner. A session loaded at page
// load has usually won that race by the time anything else settles; a view
// CLICKED into existence fetches its chunk only then, and its frame is the one a
// launch-dialog figure is about.
//
// NOT best-effort, unlike its neighbours: a view that never leaves `loading` has
// no content to fall through to, so the timeout IS the diagnosis and the caller
// should surface it.
export function waitForViewPhases(page: Page, timeoutMs: number) {
  return page.waitForFunction(
    () =>
      document.querySelector('[data-view-phase="loading"]') === null &&
      document.querySelector('[data-view-component-pending]') === null,
    { timeout: timeoutMs, polling: 500 },
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
 */
export const BUSY_SELECTOR = [
  '[data-testid="loading-overlay"]',
  '[data-busy="true"]',
  '[data-display-phase="loading"]',
  '[data-view-phase="loading"]',
].join(', ')

/**
 * Is the app doing anything right now?
 *
 * Serialized into the page, so it declares everything it uses. Two sources: the
 * selector above, and the live session model's own per-display status, which is
 * the only PER-DISPLAY signal a build with no readiness attributes has left.
 * Both are contracts rather than renderings — a model field and a set of data
 * attributes — so neither moves when the UI is restyled.
 *
 * Exported so a test can call the real function rather than a copy of it.
 */
export function isPageBusyInPage(): boolean {
  const busySelector = [
    '[data-testid="loading-overlay"]',
    '[data-busy="true"]',
    '[data-display-phase="loading"]',
    '[data-view-phase="loading"]',
  ].join(', ')
  if (document.querySelector(busySelector)) {
    return true
  }
  interface DisplayState {
    message?: string
    statusMessage?: string
  }
  interface TrackState {
    displays?: DisplayState[]
  }
  interface ViewState {
    tracks?: TrackState[]
    views?: ViewState[]
  }
  const session = (globalThis as { JBrowseSession?: { views?: ViewState[] } })
    .JBrowseSession
  const displaysOf = (v: ViewState): DisplayState[] => [
    ...(v.tracks ?? []).flatMap(t => t.displays ?? []),
    ...(v.views ?? []).flatMap(displaysOf),
  ]
  return (session?.views ?? [])
    .flatMap(displaysOf)
    .some(d => (d.message ?? d.statusMessage ?? '').trim() !== '')
}

/**
 * Wait until the app has been idle for an unbroken stretch.
 *
 * The gate for a build that publishes no readiness attributes, where every
 * other wait in this module is an assertion about an absent selector and so
 * cannot fail. Absence answers "is it working NOW"; a capture needs "has it
 * finished", and the two differ in both directions:
 *
 *   BEFORE the work starts. Measured on jbrowse.org/code/jb2/latest with two
 *   remote tracks: the session reports both tracks open at ~2.5s and the
 *   loading overlay does not go up until ~3.5s. Every absence-based gate passes
 *   during that second, over an app that has drawn nothing.
 *
 *   BETWEEN two pieces of work. A track that finishes one fetch and starts the
 *   next is momentarily idle, and a single-sample gate takes it.
 *
 * Requiring the idle to HOLD closes both without needing to know which signals
 * a given build has. Polled from node rather than in-page: chrome throttles
 * in-page timers and rAF once the tab is not visible, which is the state a
 * headless capture sits in.
 *
 * Returns false on timeout rather than throwing, like its neighbours — the
 * caller decides whether a page that never went quiet is a failure or a slow
 * page worth capturing anyway.
 */
export async function waitForQuietPeriod(
  page: Page,
  {
    quietMs = 1500,
    timeout = 30000,
    pollMs = 250,
    busyWindowMs = 0,
  }: {
    quietMs?: number
    timeout?: number
    pollMs?: number
    /**
     * Wait for the app to be seen BUSY before any idle counts, giving up on
     * that after this long. Zero (the default) accepts idle immediately.
     *
     * This is what turns the wait positive. Idle is still an absence, so an app
     * that has not begun looks exactly like one that has finished — measured on
     * jbrowse.org/code/jb2/latest, where a chain starting at the session gate
     * saw an idle page at 1.6s and the tracks did not draw until past 10s.
     * Seeing the transition INTO work and back out of it is an observation of
     * the work itself.
     *
     * The window is bounded because a page with nothing to fetch never goes
     * busy at all, and hanging on that would be worse than the race it closes.
     * Size it above the gap between the session gate passing and the first
     * indicator appearing, measured at ~1s on that instance.
     */
    busyWindowMs?: number
  } = {},
): Promise<boolean> {
  const start = Date.now()
  const deadline = start + timeout
  let quietSince: number | undefined
  let seenBusy = busyWindowMs === 0
  while (Date.now() < deadline) {
    // A page that navigates or closes under us fails the evaluate; treat that
    // as busy and let the deadline decide, rather than reporting quiet.
    const busy = await page.evaluate(isPageBusyInPage).catch(() => true)
    const now = Date.now()
    if (busy) {
      seenBusy = true
      quietSince = undefined
    } else {
      if (!seenBusy && now - start >= busyWindowMs) {
        // never went busy within the window: nothing to wait out
        seenBusy = true
        quietSince = now
      }
      if (seenBusy) {
        quietSince ??= now
        if (now - quietSince >= quietMs) {
          return true
        }
      }
    }
    await delay(pollMs)
  }
  return false
}

/**
 * Wait for the app to say it has finished.
 *
 * One selector, no chain: `[data-app-phase="ready"]` is rendered by the session
 * itself, so it cannot be satisfied before the app exists. Returns false if the
 * page never publishes it, which is how a caller tells "not ready yet" from "a
 * build too old to have the marker" and falls back.
 */
export function waitForAppReady(
  page: Page,
  { timeout = 30000 }: { timeout?: number } = {},
): Promise<boolean> {
  return settled(page.waitForSelector(APP_READY, { timeout, visible: false }))
}

/** Whether this build publishes the app-level readiness marker at all. */
export function hasAppReadyMarker(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.querySelector('[data-app-phase]') !== null,
  )
}

/**
 * Wait out work an INTERACTION started: `ready`, and still ready a beat later.
 *
 * The gate for after a click, a keystroke or a resize, where `waitForAppReady`
 * alone is not one. A page that is still LOADING starts at `loading` and the
 * transition into `ready` is the app finishing, so one read of the selector
 * answers it. After an interaction the app is already `ready` — it was finished a
 * moment ago — and stays that way until the click's work registers, so the same
 * read returns instantly, on the pre-click frame.
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
 * Polled from Node rather than by `page.waitForSelector`, for the reason
 * `waitForQuietPeriod` is: chrome throttles in-page timers and rAF once the tab
 * is not visible, which is exactly the state a headless capture sits in.
 *
 * Falls back to the quiet period on a build too old for the marker, rather than
 * passing instantly. A no-op that reports success is how a spec that dropped its
 * sleep for this ends up capturing the frame the sleep was there to avoid.
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
    return waitForQuietPeriod(page, { quietMs: holdMs, timeout, pollMs })
  }
  const deadline = Date.now() + timeout
  let readySince: number | undefined
  while (Date.now() < deadline) {
    // a page that navigates or closes under us fails the evaluate; treat that as
    // not-ready and let the deadline decide
    const ready = await page
      .evaluate(
        selector => document.querySelector(selector) !== null,
        APP_READY,
      )
      .catch(() => false)
    const now = Date.now()
    if (ready) {
      readySince ??= now
      if (now - readySince >= holdMs) {
        return true
      }
    } else {
      readySince = undefined
    }
    await delay(pollMs)
  }
  return false
}
