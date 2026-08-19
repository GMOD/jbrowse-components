import type { Page } from 'puppeteer'

// The readiness signals in waits.ts are all NEGATIVE: they pass when a selector
// is absent. That is what you want once the app is up, and worthless before it
// is — a page whose JavaScript has not yet built a session has no loading
// overlay, no `data-view-phase="loading"` and no unpainted display either, so
// every one of them passes on an empty page and a capture lands on the bare
// chrome. Measured against jbrowse.org/code/jb2/latest: `networkidle2` returns
// at ~350ms, the session model appears at ~880ms, the assembly and tracks land
// at ~2500ms, and only THEN does the loading overlay go up. A wait chain with no
// positive gate in front of it finishes in under a second and reports success.
//
// So this is the gate: a positive check, read off the live MST session model
// that jbrowse-web publishes as `window.JBrowseSession`, that the thing you
// asked for actually exists. It is also the only readiness signal that works
// across releases — see PAINT_CONTRACT_NOTE.

export interface SessionExpectations {
  /** Assembly that must be open on some view. Usually the one you navigated to. */
  assembly?: string
  /**
   * trackIds that must all be open. The exact ids, not a count: a hosted config
   * usually ships a defaultSession, so `&tracks=` ADDS to tracks that are
   * already there and a count is satisfied before your track arrives — or by
   * the default set alone when the id you passed does not exist at all.
   */
  trackIds?: string[]
}

interface TrackState {
  configuration?: { trackId?: string }
}

interface LevelState {
  tracks?: TrackState[]
}

interface ViewState {
  initialized?: boolean
  assemblyNames?: string[]
  tracks?: TrackState[]
  // A container view keeps its open tracks somewhere other than `tracks`, and
  // reading only the top level makes it look like nothing is open at all. A
  // LinearSyntenyView/DotplotView holds the synteny tracks on its LEVELS (one
  // per gap between adjacent rows) and the per-row LGV tracks on its SUB-VIEWS;
  // its own `tracks` is empty in both cases. So a capture of any synteny view
  // used to time out with "tracks []" while the track was open and drawn on
  // screen, and the error blamed the caller's config.
  levels?: LevelState[]
  views?: ViewState[]
}

// `window.JBrowseSession` is jbrowse-web's own devtools/automation handle
// (products/jbrowse-web/src/components/JBrowse.tsx). It is declared `unknown`
// there and is a live MST node here, so a cast at the page boundary is
// unavoidable. It is repeated in each function below rather than shared: every
// one of them is serialized into the page by puppeteer, so it can only call what
// it declares inside itself.

export interface SessionSummary {
  views: number
  assemblies: string[]
  trackIds: string[]
}

/** What the page currently has open, or undefined if there is no session yet. */
export function readSessionSummary(
  page: Page,
): Promise<SessionSummary | undefined> {
  return page.evaluate(readSessionSummaryInPage)
}

// Serialized into the page, so it can only call what it declares — hence the
// inlined copy of readViews rather than a shared import.
//
// Exported for its test: it reads `globalThis.JBrowseSession` and nothing else,
// so calling it in node against a stubbed global exercises the very function
// puppeteer serializes, rather than a copy of it that can drift.
export function readSessionSummaryInPage(): SessionSummary | undefined {
  const session = (
    globalThis as {
      JBrowseSession?: { views?: ViewState[] }
    }
  ).JBrowseSession
  const views = session?.views
  if (!views) {
    return undefined
  }
  // Inlined rather than shared with the gate below for the same reason as the
  // readViews copy: both are serialized into the page.
  function collect(v: ViewState): TrackState[] {
    return [
      ...(v.tracks ?? []),
      ...(v.levels ?? []).flatMap(l => l.tracks ?? []),
      ...(v.views ?? []).flatMap(collect),
    ]
  }
  return {
    views: views.length,
    assemblies: [
      ...new Set(
        views.flatMap(function asm(v: ViewState): string[] {
          return [...(v.assemblyNames ?? []), ...(v.views ?? []).flatMap(asm)]
        }),
      ),
    ],
    trackIds: views.flatMap(v =>
      collect(v).map(t => t.configuration?.trackId ?? '(unnamed)'),
    ),
  }
}

/**
 * Wait until the session exists, every view reports itself initialized, and the
 * assembly and tracks that were asked for are actually open.
 *
 * Throws on timeout rather than proceeding. A config URL that 404s, a trackId
 * that does not exist in the config, and an assembly name that does not match
 * the one the config declares all fail here, which is the only place they fail
 * at all — each of them otherwise produces a browser that loads, paints its
 * chrome, and photographs beautifully with nothing in it.
 */
export async function waitForSession(
  page: Page,
  {
    assembly,
    trackIds = [],
    timeout = 60000,
  }: SessionExpectations & { timeout?: number } = {},
) {
  try {
    // #region session-gate
    await page.waitForFunction(
      (wantAssembly: string | null, wantTracks: string[]) => {
        const session = (
          globalThis as { JBrowseSession?: { views?: ViewState[] } }
        ).JBrowseSession
        const views = session?.views
        if (!views?.length) {
          return false
        }
        // `initialized` is an LGV getter; a view type without one is mounted
        // content the moment it exists, so absent counts as initialized and
        // only an explicit false is pending.
        if (views.some(v => v.initialized === false)) {
          return false
        }
        // A container view (synteny, dotplot) keeps its assemblies on the rows
        // and its tracks on the levels, so both walks descend into sub-views
        // and levels rather than reading the top view only.
        const asmOf = (v: ViewState): string[] => [
          ...(v.assemblyNames ?? []),
          ...(v.views ?? []).flatMap(asmOf),
        ]
        if (
          wantAssembly !== null &&
          !views.some(v => asmOf(v).includes(wantAssembly))
        ) {
          return false
        }
        const tracksOf = (v: ViewState): TrackState[] => [
          ...(v.tracks ?? []),
          ...(v.levels ?? []).flatMap(l => l.tracks ?? []),
          ...(v.views ?? []).flatMap(tracksOf),
        ]
        const open = new Set(
          views.flatMap(v => tracksOf(v).map(t => t.configuration?.trackId)),
        )
        return wantTracks.every(id => open.has(id))
      },
      { timeout, polling: 250 },
      assembly ?? null,
      trackIds,
    )
    // #endregion session-gate
  } catch {
    const summary = await readSessionSummary(page)
    const found = summary
      ? `${summary.views} view(s), assemblies [${summary.assemblies.join(', ')}], tracks [${summary.trackIds.join(', ')}]`
      : 'no session on the page at all (is this a jbrowse-web instance?)'
    const missing = summary
      ? trackIds.filter(id => !summary.trackIds.includes(id))
      : trackIds
    const wanted = [
      assembly ? `assembly "${assembly}"` : undefined,
      missing.length ? `track(s) [${missing.join(', ')}]` : undefined,
    ]
      .filter(Boolean)
      .join(' and ')
    throw new Error(
      `the session never reached the requested state after ${timeout}ms. ` +
        `Wanted ${wanted || 'an initialized view'}; found ${found}. ` +
        'A config URL that 404s, a trackId the config does not define, or an ' +
        'assembly name that does not match the config all look like this.',
    )
  }
}

export const PAINT_CONTRACT_NOTE =
  'this JBrowse build publishes no data-display-drawn attributes, so "every ' +
  'display has painted" cannot be checked — only that nothing is still ' +
  'loading. Raise --settle if the image looks half-drawn.'

/**
 * Whether every open display's paint state was actually measurable.
 *
 * The per-display paint attributes are not universal. Measured on 2026-08-07:
 * jbrowse.org/code/jb2/main publishes `data-view-phase`, `data-display-phase`
 * and `data-display-drawn`; jbrowse.org/code/jb2/latest — the released build,
 * which is what every genomes.jbrowse.org link and every docs figure link opens
 * — publishes none of them and exposes only the loading overlay. Against that
 * instance the display-level waits are unfalsifiable rather than satisfied, so a
 * caller has to be told which of the two it got instead of reading "0 displays
 * pending" as good news.
 *
 * The absence of the attribute is NOT on its own the answer, which is the trap
 * here: a page with no tracks open — an import form, a menu shot, a bare view —
 * publishes none of it either, and reporting that as "this build cannot measure
 * paint" is both wrong and alarming. So this asks the question only when there
 * is something to measure, and answers true when there is not.
 *
 * Call it AFTER the session gate, so "no tracks open" means the page genuinely
 * has none rather than not having got there yet.
 */
export async function hasPaintContract(page: Page): Promise<boolean> {
  const summary = await readSessionSummary(page)
  if (summary && summary.trackIds.length === 0) {
    return true
  }
  return page.evaluate(
    () => document.querySelector('[data-display-drawn]') !== null,
  )
}

/**
 * Which readiness attributes this build publishes at all.
 *
 * `hasPaintContract` answers the same question for one attribute and folds in
 * "there was nothing to measure"; this is the raw read of all three, so the
 * chain can adapt to the build BEFORE it starts waiting rather than reporting
 * afterwards what it could not see.
 *
 * Every wait keyed on one of these is NEGATIVE — it passes when the selector is
 * absent — so on a build that publishes none of them all three are satisfied by
 * a page that has not begun to draw. Read this after the session gate and treat
 * `false` as "this signal is unavailable", never as "this signal says done".
 */
export interface Instrumentation {
  viewPhase: boolean
  displayPhase: boolean
  displayDrawn: boolean
}

/** Serialized into the page; exported so a test can call the real function. */
export function readInstrumentationInPage(): Instrumentation {
  return {
    viewPhase: document.querySelector('[data-view-phase]') !== null,
    displayPhase: document.querySelector('[data-display-phase]') !== null,
    displayDrawn: document.querySelector('[data-display-drawn]') !== null,
  }
}

export function readInstrumentation(page: Page): Promise<Instrumentation> {
  return page.evaluate(readInstrumentationInPage)
}

/**
 * Displays that were still reporting unpainted at the moment of the call.
 *
 * Distinct from `unsettled`, which says a wait ran out of time. This says what
 * the page looked like when the shutter fired, and the two do not imply each
 * other: a display can go back to pending after its stage passed. An empty
 * result means nothing at all on a build with no paint contract — check
 * `paintContract` before reading it as good news.
 */
export function pendingDisplays(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>('[data-display-drawn="false"]'),
    ].map(el => el.dataset.testid ?? (el.id || 'unnamed display')),
  )
}

/** One unpainted display and what it says about itself. */
export interface PendingDisplay {
  /** the display TYPE, shared by every instance of it */
  name: string
  /** which instance, where the display publishes `data-display-id` */
  id?: string
  /**
   * Its own phase, or undefined on a build too old to publish one. `loading` is
   * a display still fetching; `ready` is the one that earns this census, since
   * a display that says it has finished while reporting no paint is a bug in
   * the display rather than a slow page.
   */
  phase?: string
}

/**
 * The same census, with each display's own account of itself.
 *
 * `pendingDisplays` above answers WHICH, and that was the whole report: every
 * timeout read the same however it was caused. The phase separates the cases a
 * bare name runs together —
 *
 *   `loading`   still fetching. A slow page or a fetch that never returns.
 *   `error`     finished, badly. Nothing is coming; the picture is a banner.
 *   `ready`     it says it is done and reports no paint. That is the display's
 *               bug, not the wait's, and it is the one a longer timeout will
 *               never fix.
 *   absent      the element publishes no phase: a build older than the
 *               attribute, or a surface that never grew one.
 *
 * Serialized into the page, so a test can call the real function. Read fresh
 * from the DOM at report time rather than from handles the waits held. A handle to an element that has since re-rendered throws
 * `Node is detached from document`, which is how the previous attempt at this
 * turned four diagnosable timeouts into nine opaque puppeteer errors (reverted
 * in 28c6ee6d90).
 */
export function pendingDisplayStatesInPage(): PendingDisplay[] {
  return [
    ...document.querySelectorAll<HTMLElement>('[data-display-drawn="false"]'),
  ].map(el => ({
    name: el.dataset.testid ?? (el.id || 'unnamed display'),
    id: el.dataset.displayId,
    phase: el.dataset.displayPhase,
  }))
}

export function pendingDisplayStates(page: Page): Promise<PendingDisplay[]> {
  return page.evaluate(pendingDisplayStatesInPage)
}

/** `pendingDisplayStates` as one line for an error message. */
export function describePendingDisplays(pending: PendingDisplay[]) {
  return pending
    .map(
      d =>
        `${d.name}${d.id ? ` (${d.id})` : ''} is ${d.phase ?? 'in an unpublished phase'}`,
    )
    .join('; ')
}
