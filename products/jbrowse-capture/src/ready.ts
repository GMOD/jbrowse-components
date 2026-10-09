import { DEFAULT_TIMEOUT } from './poll.ts'
import {
  describeDisplays,
  displayCensusInPage,
  errorsShownInPage,
  waitForSession,
} from './sessionGate.ts'
import { appSettledBlocker } from './waits.ts'

import type { PageOrFrame } from './poll.ts'
import type { DisplayState, SessionExpectations } from './sessionGate.ts'

export interface ReadyOptions extends SessionExpectations {
  /** Budget for each wait stage. */
  timeout?: number
  /**
   * Return the report instead of throwing when a stage times out or a display
   * is not showing its data.
   */
  allowUnsettled?: boolean
}

export interface ReadyReport {
  /** Displays unpainted, canceled or showing an error, each with its phase. */
  pending: DisplayState[]
  /** Displays showing "too much data" in place of their features. Not a failure. */
  tooLarge: DisplayState[]
  /** What did not settle. Empty unless `allowUnsettled`. */
  unsettled: string[]
}

/**
 * Wait until the session holds the assembly and tracks asked for, the app has
 * held itself ready, every display has painted, and no error is on screen.
 */
export async function waitForJBrowseReady(
  page: PageOrFrame,
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
  page: PageOrFrame,
  {
    timeout = DEFAULT_TIMEOUT,
    allowUnsettled = false,
  }: Omit<ReadyOptions, keyof SessionExpectations> = {},
): Promise<ReadyReport> {
  const unsettled: string[] = []
  const blocker = await appSettledBlocker(page, { timeout })
  if (blocker) {
    unsettled.push(
      `the app never held itself ready (last blocked by ${blocker})`,
    )
  }
  const timedOut = unsettled.length > 0

  const { pending, tooLarge } = await page.evaluate(displayCensusInPage)
  const failed = pending.filter(
    d => d.phase === 'error' || d.phase === 'renderError',
  )
  const canceled = pending.filter(d => d.phase === 'canceled')
  const unpainted = pending.filter(
    d => !failed.includes(d) && !canceled.includes(d),
  )
  if (failed.length > 0) {
    unsettled.push(`display(s) showing an error: ${describeDisplays(failed)}`)
  }
  if (unpainted.length > 0) {
    unsettled.push(`display(s) never painted: ${describeDisplays(unpainted)}`)
  }
  if (canceled.length > 0) {
    unsettled.push(
      `display(s) canceled, which lasts until Retry: ${describeDisplays(canceled)}`,
    )
  }
  const errors = await page.evaluate(errorsShownInPage)
  if (errors.length > 0) {
    unsettled.push(`error(s) on screen: ${errors.join('; ')}`)
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
