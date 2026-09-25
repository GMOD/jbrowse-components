import { holdTrue } from './poll.ts'
import { describeDisplays, displayCensusInPage } from './sessionGate.ts'

import type { ElementHandle, Page } from 'puppeteer'

interface WaitOptions {
  timeout?: number
}

async function settled(work: Promise<unknown>) {
  try {
    await work
    return true
  } catch {
    return false
  }
}

export const LOADING_OVERLAY = '[data-testid="loading-overlay"]'

/** The app's own verdict: no view is resolving an assembly, no display is fetching. */
export const APP_READY = '[data-app-phase="ready"]'

/** An engine still working, of the several a page of embedded views may hold. */
const APP_LOADING = '[data-app-phase="loading"]'

/** A display drawing a transition between two settled pictures. */
export const ANIMATING_DISPLAYS = '[data-display-animating="true"]'

/** Displays that have not yet drawn anything. */
export const PENDING_DISPLAYS = '[data-display-drawn="false"]'

const VIEW_COMPONENT_PENDING = '[data-view-component-pending]'

// longer than the ~600ms FetchVisibleRegions debounce, so the gap between one
// fetch and the next cannot pass for settled
const APP_SETTLED_HOLD_MS = 1000

/** Everything the app publishes to say it is working, as one selector. */
export const BUSY_SELECTOR = [
  LOADING_OVERLAY,
  '[data-busy="true"]',
  '[data-display-phase="loading"]',
  '[data-view-phase="loading"]',
  ANIMATING_DISPLAYS,
].join(', ')

/** A display of this type that has drawn something, possibly mid-fetch. */
export const displayPainted = (testid: string) =>
  `[data-testid="${testid}"][data-display-drawn="true"]`

/** A display of this type whose fetch has finished. */
export const displaySettled = (testid: string) =>
  `[data-testid="${testid}"][data-display-phase="ready"]`

export function isPageBusyInPage(busySelector: string) {
  return document.querySelector(busySelector) !== null
}

/** Throws if the loading overlay is still up after `timeout`. */
export async function waitForLoadingComplete(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  await page.waitForFunction(
    (selector: string) => document.querySelector(selector) === null,
    { timeout, polling: 'mutation' },
    LOADING_OVERLAY,
  )
}

/**
 * Wait until nothing on the page reports itself busy, and has stayed that way
 * for `quietMs`. False on timeout. An app that has not started is not busy
 * either, so this is no readiness gate; `waitForAppSettled` is.
 */
export function waitForQuiescent(
  page: Page,
  {
    timeout = 30000,
    quietMs = 0,
    pollMs = 250,
  }: WaitOptions & { quietMs?: number; pollMs?: number } = {},
) {
  return holdTrue(
    () =>
      page.evaluate(isPageBusyInPage, BUSY_SELECTOR).then(
        busy => !busy,
        () => false,
      ),
    { holdMs: quietMs, timeout, pollMs },
  )
}

async function describeDisplaysNow(page: Page) {
  try {
    const { pending, tooLarge } = await page.evaluate(displayCensusInPage)
    const found = [
      pending.length
        ? `${pending.length} display(s) had not painted: ${describeDisplays(pending)}`
        : undefined,
      tooLarge.length
        ? `${tooLarge.length} display(s) show "too much data" in place of their features: ${describeDisplays(tooLarge)}`
        : undefined,
    ].filter(Boolean)
    return found.length
      ? found.join('; ')
      : 'no display reported itself unpainted, so the selector was not on a display'
  } catch {
    return 'the page could not be queried afterwards (context gone)'
  }
}

/**
 * `page.waitForSelector`, whose timeout names each display that had not
 * painted and the phase it was in.
 */
export async function waitForSelectorAttributed(
  page: Page,
  selector: string,
  { timeout = 30000 }: WaitOptions = {},
): Promise<ElementHandle> {
  try {
    const handle = await page.waitForSelector(selector, { timeout })
    if (!handle) {
      throw new Error(`element not found: ${selector}`)
    }
    return handle
  } catch (cause) {
    throw new Error(
      `${selector} did not appear within ${timeout}ms — ${await describeDisplaysNow(page)}`,
      { cause },
    )
  }
}

/**
 * Wait until no unpainted display could still paint: each is in a finished
 * phase, or there are none. False on timeout. Only meaningful once the views
 * have mounted.
 */
export function waitForDisplaysDone(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  return settled(
    page.waitForFunction(
      (selector: string) =>
        [...document.querySelectorAll<HTMLElement>(selector)].every(
          el =>
            el.dataset.displayPhase !== undefined &&
            el.dataset.displayPhase !== 'loading',
        ),
      { timeout, polling: 'mutation' },
      PENDING_DISPLAYS,
    ),
  )
}

/** Wait until no display is fetching. False on timeout. */
export function waitForDisplayPhases(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  return settled(
    page.waitForFunction(
      () => document.querySelector('[data-display-phase="loading"]') === null,
      { timeout, polling: 'mutation' },
    ),
  )
}

/**
 * Throws unless every view has resolved its assembly and loaded its
 * component within `timeout`.
 */
export async function waitForViewPhases(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  await page.waitForFunction(
    (pending: string) =>
      document.querySelector('[data-view-phase="loading"]') === null &&
      document.querySelector(pending) === null,
    { timeout, polling: 'mutation' },
    VIEW_COMPONENT_PENDING,
  )
}

/**
 * Wait for the first frame the app calls ready. False on timeout. After an
 * interaction the app already reads ready, so use `waitForAppSettled` there.
 */
export function waitForAppReady(
  page: Page,
  { timeout = 30000 }: WaitOptions = {},
) {
  return settled(page.waitForSelector(APP_READY, { timeout }))
}

/**
 * Wait until every app on the page has read ready, with no view component
 * loading and no display animating, for an unbroken `holdMs`. False on timeout. Throws on a
 * page that publishes no `[data-app-phase]`, where nothing positive exists to
 * wait for.
 */
export async function waitForAppSettled(
  page: Page,
  {
    timeout = 30000,
    holdMs = APP_SETTLED_HOLD_MS,
    pollMs = 250,
  }: WaitOptions & { holdMs?: number; pollMs?: number } = {},
) {
  const hasMarker = await page.evaluate(
    () => document.querySelector('[data-app-phase]') !== null,
  )
  if (!hasMarker) {
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
          (ready, loading, pending, animating) =>
            document.querySelector(ready) !== null &&
            document.querySelector(loading) === null &&
            document.querySelector(pending) === null &&
            document.querySelector(animating) === null,
          APP_READY,
          APP_LOADING,
          VIEW_COMPONENT_PENDING,
          ANIMATING_DISPLAYS,
        )
        .catch(() => false),
    { holdMs, timeout, pollMs },
  )
}
