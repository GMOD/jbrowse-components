import { delay } from './poll.ts'
import {
  describePendingDisplays,
  pendingDisplayStates,
  tooLargeDisplaysInPage,
  waitForSession,
} from './sessionGate.ts'
import { waitForAppSettled, waitForDisplaysDone } from './waits.ts'

import type { PendingDisplay, SessionExpectations } from './sessionGate.ts'
import type { Page } from 'puppeteer'

// The whole ready chain, in a module that touches puppeteer only through its
// types — capture.ts holds the runtime import (launching a browser), which is
// what keeps the chain callable under jest against a stubbed Page.

export interface ReadyOptions extends SessionExpectations {
  /** Budget for each individual wait stage. */
  timeout?: number
  /**
   * Extra pause after every stage reports done, for animations and tooltips —
   * and for a display finishing its first paint, since the census that decides
   * whether the run failed is taken after this rather than before it.
   */
  settleMs?: number
  /**
   * Return the report instead of throwing when a wait stage times out. For
   * capturing a page that is deliberately mid-load, or accepting a known-slow
   * one. The unsettled stages are still listed in the report either way.
   */
  allowUnsettled?: boolean
}

export interface ReadyReport {
  /**
   * Displays still reporting unpainted, or canceled, at the end of the wait,
   * each with the phase it publishes: what separates a slow fetch from a
   * display that says it finished without painting.
   */
  pending: PendingDisplay[]
  /**
   * Displays showing "too much data" instead of their features. Not a failure,
   * so never in `unsettled`, but worth saying: the image shows a banner there.
   */
  tooLarge: PendingDisplay[]
  /** Wait stages that hit their timeout instead of being satisfied. */
  unsettled: string[]
}

/**
 * Wait until a JBrowse page has finished loading AND finished drawing.
 *
 * Two gates, both positive, which is the property that matters — every other
 * readiness signal the app publishes is an ABSENCE, and an absence is equally
 * true of an app that has not started.
 *
 * 1. The census says the assembly and trackIds you asked for are open.
 * 2. `[data-app-phase="ready"]` HOLDS: no view is resolving an assembly and no
 *    display is fetching, and still not a beat later. A display drops to
 *    `ready` in the gap between one fetch finishing and the debounced next one
 *    starting, so a single read takes that gap for the end.
 *
 * Then one negative gate that is only meaningful after them, and answers the
 * question the marker does not: the marker is about WORK, and a display whose
 * fetch failed is not working — it reads `ready` over an error banner, and over
 * a user's cancel. `data-display-drawn` is the stricter gate, and the census
 * after it names a canceled display whatever it drew.
 */
export async function waitForJBrowseReady(
  page: Page,
  options: ReadyOptions = {},
): Promise<ReadyReport> {
  // The census the gate reads shares its element with `[data-app-phase]`, so
  // once it passes the marker is there too. Handed the options whole, so every
  // session expectation reaches it, `views` included.
  await waitForSession(page, options)
  return waitForFrame(page, options)
}

/**
 * The half of `waitForJBrowseReady` after the session gate: the marker held,
 * every display painted, and the census of what did not. Run again after
 * anything that changes the frame without changing the session, such as a
 * viewport resize.
 */
export async function waitForFrame(
  page: Page,
  {
    timeout = 60000,
    settleMs = 0,
    allowUnsettled = false,
  }: Omit<ReadyOptions, keyof SessionExpectations> = {},
): Promise<ReadyReport> {
  const unsettled: string[] = []
  // the paint wait is skipped once the marker timed out, so a stuck page costs
  // one timeout rather than two
  if (!(await waitForAppSettled(page, { timeout }))) {
    unsettled.push('the app never held itself ready')
  } else if (!(await waitForDisplaysDone(page, timeout))) {
    unsettled.push('a display never reported its first paint')
  }
  const timedOut = unsettled.length > 0

  if (settleMs > 0) {
    await delay(settleMs)
  }

  // taken after the settle, so the throw and the report describe the captured
  // frame
  const pending = await pendingDisplayStates(page)
  const canceled = pending.filter(d => d.phase === 'canceled')
  const unpainted = pending.filter(d => d.phase !== 'canceled')
  if (unpainted.length > 0) {
    unsettled.push(
      `display(s) never painted: ${describePendingDisplays(unpainted)}`,
    )
  }
  if (canceled.length > 0) {
    unsettled.push(
      `display(s) canceled, which lasts until Retry: ${describePendingDisplays(canceled)}`,
    )
  }
  if (!allowUnsettled && unsettled.length > 0) {
    const stillLoading = pending.some(
      d => d.phase === undefined || d.phase === 'loading',
    )
    throw new Error(
      `${timedOut ? `gave up waiting after ${timeout}ms: ` : ''}${unsettled.join('; ')}. ` +
        (timedOut || stillLoading
          ? 'Raise the timeout, or pass'
          : 'No timeout changes that; pass') +
        ' allowUnsettled (--allowUnsettled) to capture the frame as it stands.',
    )
  }
  const tooLarge = await page.evaluate(tooLargeDisplaysInPage)
  return { pending, tooLarge, unsettled }
}
