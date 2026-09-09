import type { Page } from 'puppeteer'

// The readiness signals in waits.ts are all NEGATIVE: they pass when a selector
// is absent. That is what you want once the app is up, and worthless before it
// is — a page whose JavaScript has not yet built a session has no loading
// overlay, no `data-view-phase="loading"` and no unpainted display either, so
// every one of them passes on an empty page and a capture lands on the bare
// chrome. Measured against a released build: `networkidle2` returns at ~350ms,
// the session appears at ~880ms, the assembly and tracks land at ~2500ms, and
// only THEN does the loading overlay go up. A wait chain with no positive gate
// in front of it finishes in under a second and reports success.
//
// So this is the gate: a positive check that the thing you asked for actually
// exists, read off the census the app publishes beside its readiness phase.

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

/**
 * The census the app publishes beside its phase: `AppReadyMarker` renders
 * `data-app-views` (a count), and `data-app-assemblies` / `data-app-tracks`
 * (JSON string arrays of what is open).
 *
 * One element answers the whole gate. Each view declares what it holds and
 * `openViews`/`openTracks` reduce over those declarations (ADR-103), so nothing
 * here has to know that a synteny view keeps its tracks on levels and its rows
 * on sub-views — the duck-typed walk of `window.JBrowseSession` that used to
 * live here, and drifted against the copy in `isPageBusyInPage`, is gone with
 * the builds that needed it.
 *
 * `scripts/readinessContract.test.ts` pins the attribute names against the
 * marker, since neither package may import the other.
 */
export const APP_CENSUS = '[data-app-tracks]'

export interface SessionSummary {
  views: number
  assemblies: string[]
  trackIds: string[]
}

/** What the page currently has open, or undefined if there is no census yet. */
export function readSessionSummary(
  page: Page,
): Promise<SessionSummary | undefined> {
  return page.evaluate(readSessionSummaryInPage)
}

// Serialized into the page, so it can only call what it declares. Exported for
// its test: it reads the document and nothing else, so calling it in node
// against a staged DOM exercises the very function puppeteer serializes, rather
// than a copy of it that can drift.
export function readSessionSummaryInPage(): SessionSummary | undefined {
  const marker = document.querySelector<HTMLElement>('[data-app-tracks]')
  if (!marker) {
    return undefined
  }
  try {
    return {
      views: Number(marker.dataset.appViews) || 0,
      assemblies: JSON.parse(marker.dataset.appAssemblies ?? '[]') as string[],
      trackIds: JSON.parse(marker.dataset.appTracks ?? '[]') as string[],
    }
  } catch {
    return undefined
  }
}

/**
 * Wait until the census exists and the assembly and tracks that were asked for
 * are actually open.
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
        const marker = document.querySelector<HTMLElement>('[data-app-tracks]')
        if (!marker) {
          return false
        }
        try {
          const openViews = Number(marker.dataset.appViews) || 0
          const assemblies = JSON.parse(
            marker.dataset.appAssemblies ?? '[]',
          ) as string[]
          const openTracks = JSON.parse(
            marker.dataset.appTracks ?? '[]',
          ) as string[]
          return (
            openViews > 0 &&
            (wantAssembly === null || assemblies.includes(wantAssembly)) &&
            wantTracks.every(id => openTracks.includes(id))
          )
        } catch {
          return false
        }
      },
      { timeout, polling: 250 },
      assembly ?? null,
      trackIds,
    )
    // #endregion session-gate
  } catch {
    // Best-effort: the wait may have failed because the page crashed or
    // navigated, and an unguarded evaluate here would replace the diagnostic
    // below with its own opaque error.
    const summary = await readSessionSummary(page).catch(() => undefined)
    const found = summary
      ? `${summary.views} view(s), assemblies [${summary.assemblies.join(', ')}], tracks [${summary.trackIds.join(', ')}]`
      : 'no census on the page at all — either this is not a JBrowse app, or ' +
        'it predates the readiness marker, in which case point --instance at a ' +
        'build that publishes one'
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
        `Wanted ${wanted || 'an open view'}; found ${found}. ` +
        'A config URL that 404s, a trackId the config does not define, or an ' +
        'assembly name that does not match the config all look like this.',
    )
  }
}

/**
 * Displays that were still reporting unpainted at the moment of the call.
 *
 * Distinct from `unsettled`, which says a wait ran out of time. This says what
 * the page looked like when the shutter fired.
 */
export async function pendingDisplays(page: Page): Promise<string[]> {
  return (await pendingDisplayStates(page)).map(d => d.name)
}

/** One unpainted display and what it says about itself. */
export interface PendingDisplay {
  /** the display TYPE, shared by every instance of it */
  name: string
  /** which instance, where the display publishes `data-display-id` */
  id?: string
  /**
   * Its own phase. `loading` is a display still fetching; `ready` is the one
   * that earns this census, since a display that says it has finished while
   * reporting no paint is a bug in the display rather than a slow page.
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
 *
 * Serialized into the page, so a test can call the real function. Read fresh
 * from the DOM at report time rather than from handles the waits held. A handle
 * to an element that has since re-rendered throws `Node is detached from
 * document`, which is how the previous attempt at this turned four diagnosable
 * timeouts into nine opaque puppeteer errors (reverted in 28c6ee6d90).
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
