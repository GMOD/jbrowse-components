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
    () =>
      document.querySelectorAll('[data-testid="loading-overlay"]').length === 0,
    { timeout },
  )
  return waitForDownloads
    ? settled(
        page.waitForFunction(
          () => !document.body.innerText.includes('Downloading'),
          { timeout },
        ),
      )
    : true
}

// Wait until no element with a *visible* "Loading…/Rendering…/Computing…" label
// remains on screen. Complements waitForLoadingComplete (which keys off the
// loading-overlay test-id and "Downloading" text): some views — e.g. the
// Protein3d ProteinView's "Loading pairwise alignment" banner — paint their own
// transient status text that no test-id covers, and a screenshot taken while it
// shows captures a half-loaded view.
//
// The match is visibility-aware on purpose. The LoadingOverlay keeps the literal
// word "Loading" in the DOM hidden via opacity:0, so a plain text search would
// never clear; here we ignore any element that (or whose ancestor) is
// display:none / visibility:hidden / opacity:0 / zero-size. We compare each
// element's OWN text nodes (not descendant text) so a large container that
// merely wraps a loading child doesn't count.
//
// Best-effort: a view that is genuinely stuck loading (rather than slow) would
// otherwise burn the whole timeout, so we swallow the rejection and let the
// caller proceed — no worse than not waiting, and slow-but-finishing views now
// get captured at the right moment instead of relying on a fixed settle.
//
// The candidate set comes from a text-node TreeWalker rather than from
// `body *`. This is the only wait here that is O(DOM) instead of one
// querySelector, and puppeteer polls it every animation frame: walking every
// element to build its own-text string, on a page with thousands of them,
// competed for main-thread time with the render it was waiting on. Only
// elements that HAVE own text can ever match, and only a matching element needs
// its style resolved, so both the string building and `getComputedStyle` now run
// on a few hundred nodes instead of all of them. Same answer — an element with
// no own text could never pass `t.length > 0` — so this is a cost change, not a
// semantic one.
export async function waitForQuiescent(
  page: Page,
  {
    timeout = 30000,
    pattern = /^(loading|rendering|computing|aligning)\b/i,
  }: { timeout?: number; pattern?: RegExp } = {},
): Promise<boolean> {
  return settled(
    page.waitForFunction(
      (source: string, flags: string) => {
        const re = new RegExp(source, flags)
        const visible = (el: Element) => {
          let cur: Element | null = el
          while (cur) {
            const s = getComputedStyle(cur)
            if (
              s.display === 'none' ||
              s.visibility === 'hidden' ||
              Number(s.opacity) === 0
            ) {
              return false
            }
            cur = cur.parentElement
          }
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }
        const ownText = (el: Element) =>
          Array.from(el.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent ?? '')
            .join('')
            .trim()
        // every element with at least one non-whitespace text child, which is
        // exactly the set that can pass the `t.length > 0` test below. Inlined
        // rather than shared with the identical walk in the website generator's
        // assertRenderSettled: this whole function is serialized into the page,
        // so it can only call what it declares.
        // querySelector, not `document.body`, because lib.dom types the latter
        // as a non-null HTMLElement — it is null while the document is still
        // parsing, but a `const` annotated `HTMLElement | null` narrows straight
        // back to non-null off its initializer, so the guard below read as
        // always-false to the type-aware lint. The check has to stay: without
        // it createTreeWalker(null) throws, waitForQuiescent's own
        // `.catch(() => {})` swallows it, and a still-parsing page comes back
        // quiescent — the exact inversion this is here to prevent.
        const body = document.querySelector('body')
        if (!body) {
          // still parsing: not quiescent, rather than trivially quiescent
          return false
        }
        const candidates = new Set<Element>()
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const parent = n.parentElement
          const text = n.textContent ?? ''
          if (parent && parent !== body && text.trim()) {
            candidates.add(parent)
          }
        }
        for (const el of candidates) {
          const t = ownText(el)
          if (t.length > 0 && t.length < 80 && re.test(t) && visible(el)) {
            return false
          }
        }
        return true
      },
      { timeout },
      pattern.source,
      pattern.flags,
    ),
  )
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
