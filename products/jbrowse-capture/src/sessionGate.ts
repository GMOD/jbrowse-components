import { DEFAULT_TIMEOUT, holdTrue } from './poll.ts'

import type { Page } from 'puppeteer'

export interface SessionExpectations {
  /** Assembly that must be open on some view. */
  assembly?: string
  /**
   * trackIds that must all be open. Exact ids rather than a count, since a
   * config's default session may already hold others.
   */
  trackIds?: string[]
  /** The fewest open views that count. Default 1; 0 accepts none. */
  views?: number
}

export interface SessionCensus {
  views: number
  assemblies: string[]
  trackIds: string[]
}

/**
 * The load failure the app shows in place of itself, and the census
 * `AppReadyMarker` publishes beside its phase. Serialized into the page.
 */
export function readSessionInPage(): {
  failure?: string
  census?: SessionCensus
} {
  const failure =
    document.querySelector<HTMLElement>('[data-app-error]')?.dataset.appError
  const marker = document.querySelector<HTMLElement>('[data-app-tracks]')
  if (!marker) {
    return { failure }
  }
  try {
    return {
      failure,
      census: {
        views: Number(marker.dataset.appViews) || 0,
        assemblies: JSON.parse(
          marker.dataset.appAssemblies ?? '[]',
        ) as string[],
        trackIds: JSON.parse(marker.dataset.appTracks ?? '[]') as string[],
      },
    }
  } catch {
    return { failure }
  }
}

/**
 * Wait until the census shows the assembly and tracks that were asked for.
 * Throws at once with the app's message if it could not load, and on timeout
 * with what the census held instead.
 */
export async function waitForSession(
  page: Page,
  {
    assembly,
    trackIds = [],
    views = 1,
    timeout = DEFAULT_TIMEOUT,
  }: SessionExpectations & { timeout?: number } = {},
) {
  let last: SessionCensus | undefined
  const reached = await holdTrue(
    async () => {
      const { failure, census } = await page
        .evaluate(readSessionInPage)
        .catch(() => ({ failure: undefined, census: undefined }))
      if (failure) {
        throw new Error(`JBrowse could not load: ${failure}`)
      }
      last = census
      return (
        !!census &&
        census.views >= views &&
        (assembly === undefined || census.assemblies.includes(assembly)) &&
        trackIds.every(id => census.trackIds.includes(id))
      )
    },
    { holdMs: 0, timeout, pollMs: 250 },
  )
  if (!reached) {
    const census = last
    const found = census
      ? `${census.views} view(s), assemblies [${census.assemblies.join(', ')}], tracks [${census.trackIds.join(', ')}]`
      : 'no census on the page at all, so either this is not a JBrowse app or ' +
        'it is older than v5, the first release to publish one'
    const missing = trackIds.filter(id => !census?.trackIds.includes(id))
    const wanted = [
      assembly ? `assembly "${assembly}"` : undefined,
      missing.length ? `track(s) [${missing.join(', ')}]` : undefined,
    ]
      .filter(Boolean)
      .join(' and ')
    throw new Error(
      `the session never reached the requested state after ${timeout}ms. ` +
        `Wanted ${wanted || (views > 0 ? 'an open view' : 'a session')}; found ${found}. ` +
        'A trackId the config does not define, or an assembly name that does ' +
        'not match the config, looks like this.',
    )
  }
}

/** One display and the phase it publishes. */
export interface DisplayState {
  /** The display type, or its id where a banner has replaced the display. */
  name: string
  id?: string
  phase?: string
}

/**
 * Displays that are not showing their data. `pending`: unpainted, canceled,
 * or failed to render, each failing a capture — `loading` is still fetching,
 * `error` and `renderError` show a banner, `canceled` lasts until Retry, and
 * `ready` is a display that says it finished without painting. `tooLarge`:
 * showing "too much data", which is the app working as designed. Serialized
 * into the page.
 */
export function displayCensusInPage() {
  const pending: DisplayState[] = []
  const tooLarge: DisplayState[] = []
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-display-drawn="false"], [data-display-phase="canceled"], [data-display-phase="renderError"], [data-display-phase="tooLarge"]',
  )) {
    const phase = el.dataset.displayPhase
    ;(phase === 'tooLarge' ? tooLarge : pending).push({
      name: el.dataset.testid ?? el.dataset.displayId ?? 'unnamed display',
      id: el.dataset.displayId,
      phase,
    })
  }
  return { pending, tooLarge }
}

/** Displays as one clause for a message. */
export function describeDisplays(displays: DisplayState[]) {
  return displays
    .map(
      d =>
        `${d.name}${d.id && d.id !== d.name ? ` (${d.id})` : ''} is ${d.phase ?? 'in an unpublished phase'}`,
    )
    .join('; ')
}
