import { DEFAULT_TIMEOUT, delay } from './poll.ts'
import {
  describeDisplays,
  displayCensusInPage,
  waitForSession,
} from './sessionGate.ts'
import { waitForAppSettled, waitForDisplaysDone } from './waits.ts'

import type { DisplayState, SessionExpectations } from './sessionGate.ts'
import type { Page } from 'puppeteer'

export interface ReadyOptions extends SessionExpectations {
  /** Budget for each wait stage. */
  timeout?: number
  /** Pause after every stage reports done, before the census and the shot. */
  settleMs?: number
  /**
   * Return the report instead of throwing when a stage times out or a display
   * is not showing its data.
   */
  allowUnsettled?: boolean
}

export interface ReadyReport {
  /** Displays unpainted, canceled or failed to render, each with its phase. */
  pending: DisplayState[]
  /** Displays showing "too much data" in place of their features. Not a failure. */
  tooLarge: DisplayState[]
  /** What did not settle. Empty unless `allowUnsettled`. */
  unsettled: string[]
}

/**
 * Wait until the session holds the assembly and tracks asked for, the app has
 * held itself ready, and every display has painted.
 */
export async function waitForJBrowseReady(
  page: Page,
  options: ReadyOptions = {},
): Promise<ReadyReport> {
  await waitForSession(page, options)
  return waitForFrame(page, options)
}

/**
 * `waitForJBrowseReady` without the session gate, for a frame that changed
 * while the session did not, such as after a viewport resize.
 */
export async function waitForFrame(
  page: Page,
  {
    timeout = DEFAULT_TIMEOUT,
    settleMs = 0,
    allowUnsettled = false,
  }: Omit<ReadyOptions, keyof SessionExpectations> = {},
): Promise<ReadyReport> {
  const unsettled: string[] = []
  // the paint wait is skipped once the marker timed out, so a stuck page costs
  // one timeout rather than two
  if (!(await waitForAppSettled(page, { timeout }))) {
    unsettled.push('the app never held itself ready')
  } else if (!(await waitForDisplaysDone(page, { timeout }))) {
    unsettled.push('a display never reported its first paint')
  }
  const timedOut = unsettled.length > 0

  if (settleMs > 0) {
    await delay(settleMs)
  }

  // taken after the settle, so the throw and the report describe the captured
  // frame
  const { pending, tooLarge } = await page.evaluate(displayCensusInPage)
  const canceled = pending.filter(d => d.phase === 'canceled')
  const unpainted = pending.filter(d => d.phase !== 'canceled')
  if (unpainted.length > 0) {
    unsettled.push(`display(s) never painted: ${describeDisplays(unpainted)}`)
  }
  if (canceled.length > 0) {
    unsettled.push(
      `display(s) canceled, which lasts until Retry: ${describeDisplays(canceled)}`,
    )
  }
  if (!allowUnsettled && unsettled.length > 0) {
    const stillLoading = pending.some(
      d => d.phase === undefined || d.phase === 'loading',
    )
    const advice =
      timedOut || stillLoading
        ? 'Raise the timeout, or pass'
        : 'No timeout changes that; pass'
    throw new Error(
      `${timedOut ? `gave up waiting after ${timeout}ms: ` : ''}${unsettled.join('; ')}. ${advice} allowUnsettled (--allowUnsettled) to capture the frame as it stands.`,
    )
  }
  return { pending, tooLarge, unsettled }
}
