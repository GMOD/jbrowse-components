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
  const { assembly, trackIds, timeout } = options
  // The census the gate reads shares its element with `[data-app-phase]`, so
  // once it passes the marker is there too.
  await waitForSession(page, { assembly, trackIds, timeout })
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
  const ready = await waitForAppSettled(page, { timeout })
  if (!ready) {
    unsettled.push('the app never held itself ready')
  }
  // Skipped when the marker itself timed out: the paint wait would spend a
  // second full timeout on a page already known unsettled, and the census below
  // reports the unpainted displays either way. Free on a page with no canvas.
  if (ready) {
    const drawn = await waitForDisplaysDone(page, timeout)
    if (!drawn) {
      unsettled.push('a display never reported its first paint')
    }
  }

  if (settleMs > 0) {
    await delay(settleMs)
  }

  // The shutter-time census, taken ONCE and after the settle, so the throw and
  // the report it ships with agree. Taken before it they did not: a display
  // that painted during `settleMs` was absent from `pending` and still failed
  // the run, while the CLI's own warning recommended raising `--settle` to fix
  // exactly that.
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
    // Throwing is the point. Each stage swallows its own timeout so a slow page
    // is not failed for being slow, which historically meant the run ended with
    // an image and an exit code of 0 whether it had settled or not. A caller
    // that genuinely wants the frame anyway asks for it by name.
    throw new Error(
      unsettled.length === 1 && canceled.length > 0
        ? `${unsettled[0]}. No timeout lifts a cancel; press Retry on the ` +
            'track, or pass allowUnsettled (--allowUnsettled) to capture the ' +
            'frame as it stands.'
        : `gave up waiting after ${timeout}ms: ${unsettled.join('; ')}. ` +
            'Raise the timeout, or pass allowUnsettled (--allowUnsettled) to ' +
            'capture the frame as it stands.',
    )
  }
  const tooLarge = await page.evaluate(tooLargeDisplaysInPage)
  return { pending, tooLarge, unsettled }
}
