import { DEFAULT_TIMEOUT, holdTrue } from './poll.ts'
import { describeDisplays, displayCensusInPage } from './sessionGate.ts'

import type { ElementHandle, Page } from 'puppeteer'

interface WaitOptions {
  timeout?: number
}

/** The app's own verdict: no view is resolving an assembly, no display is fetching. */
export const APP_READY = '[data-app-phase="ready"]'

/** Displays that have not yet drawn anything. */
export const PENDING_DISPLAYS = '[data-display-drawn="false"]'

// longer than the ~600ms FetchVisibleRegions debounce, so the gap between one
// fetch and the next cannot pass for settled
const APP_SETTLED_HOLD_MS = 1000

/** A display of this type that has drawn something, possibly mid-fetch. */
export const displayPainted = (testid: string) =>
  `[data-testid="${testid}"][data-display-drawn="true"]`

/** A display of this type whose fetch has finished. */
export const displaySettled = (testid: string) =>
  `[data-testid="${testid}"][data-display-phase="ready"]`

async function describeDisplaysNow(page: Page) {
  try {
    const { pending, tooLarge } = await page.evaluate(displayCensusInPage)
    const found = [
      pending.length
        ? `${pending.length} display(s) were not showing their data: ${describeDisplays(pending)}`
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
  { timeout = DEFAULT_TIMEOUT }: WaitOptions = {},
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

// What each term of the settled hold waits out, as a timeout names it. The
// marker reads `loading` over a display that is fetching or has not painted,
// but only over the displays its view walk finds, so a plugin view that does
// not declare its `ownTracks` is held by the display term. `data-busy` is every
// `LoadingEllipses`: a view body still loading its code, and the panels,
// widgets and dialogs no view walk reaches.
const SETTLE_BLOCKERS: [selector: string, reason: string][] = [
  ['[data-app-phase="loading"]', 'an app still loading'],
  ['[data-display-phase="loading"]', 'a display still loading'],
  ['[data-busy="true"]', 'a loading indicator still up'],
  ['[data-display-animating="true"]', 'a display still animating'],
]

const NO_MARKER = 'no [data-app-phase] on the page'

type SettleOptions = WaitOptions & { holdMs?: number; pollMs?: number }

/**
 * `waitForAppSettled`, answering with what was still blocking at the timeout,
 * or undefined once the hold passed.
 */
export async function appSettledBlocker(
  page: Page,
  {
    timeout = DEFAULT_TIMEOUT,
    holdMs = APP_SETTLED_HOLD_MS,
    pollMs = 250,
  }: SettleOptions = {},
) {
  const blocker = () =>
    page
      .evaluate(
        (ready, blockers, noMarker) =>
          document.querySelector('[data-app-phase]') === null
            ? noMarker
            : (blockers.find(([selector]) =>
                document.querySelector(selector),
              )?.[1] ??
              (document.querySelector(ready) === null
                ? 'the marker not reading ready'
                : undefined)),
        APP_READY,
        SETTLE_BLOCKERS,
        NO_MARKER,
      )
      .catch(() => 'the page could not be queried')
  const held = await holdTrue(async () => (await blocker()) === undefined, {
    holdMs,
    timeout,
    pollMs,
  })
  if (held) {
    return undefined
  }
  const last = await blocker()
  if (last === NO_MARKER) {
    throw new Error(
      `this page published no [data-app-phase] within ${timeout}ms, so there ` +
        'is nothing positive to wait for — every other readiness attribute is ' +
        'an absence an app that has not started also satisfies. A JBrowse ' +
        'older than v5 publishes none.',
    )
  }
  return last ?? 'a hold the timeout cut short'
}

/**
 * Wait until every app on the page has read ready, with nothing loading or
 * animating, for an unbroken `holdMs`. False on timeout. Right after a
 * navigation it first waits for the marker to mount; a page that never
 * publishes `[data-app-phase]` throws, since nothing positive exists to wait
 * for.
 */
export async function waitForAppSettled(page: Page, options?: SettleOptions) {
  return (await appSettledBlocker(page, options)) === undefined
}
