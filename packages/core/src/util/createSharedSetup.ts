import type { BaseOptions } from '../data_adapters/BaseAdapter/types.ts'

/**
 * One-time adapter setup (download + parse a whole file) shared by every caller
 * that needs it, and reported to whichever of them is waiting.
 *
 * Replaces the hand-rolled `this.setupP ??= this.setupPre(opts).catch(...)`
 * every in-memory adapter carried. That form memoized the *first* caller's
 * `opts`, so its `statusCallback` was the only one the parse ever reported to:
 * once that fetch was superseded (its callback gated off by the display's
 * latest-wins guard) the fetch replacing it awaited the same promise in
 * silence, and a multi-GB PAF parsed behind a blank loading overlay. Progress
 * fans in to the live waiter set instead, so the bar belongs to whoever is
 * actually on screen.
 *
 * `stopToken` is deliberately dropped: the work is shared, so honoring one
 * caller's cancel would abort a parse the caller replacing it is already
 * waiting on, and reject them both. A superseded fetch just stops listening.
 * Cancellation stays with the per-call work (indexed range queries), which no
 * one else is waiting on.
 *
 * A rejection clears the memo, so the next caller retries rather than
 * inheriting a permanent failure.
 */
export function createSharedSetup<T>(run: (opts: BaseOptions) => Promise<T>) {
  const waiting = new Set<NonNullable<BaseOptions['statusCallback']>>()
  let promise: Promise<T> | undefined

  return async (opts: BaseOptions = {}) => {
    const { statusCallback } = opts
    if (statusCallback) {
      waiting.add(statusCallback)
    }
    promise ??= run({
      ...opts,
      stopToken: undefined,
      statusCallback: status => {
        for (const cb of waiting) {
          cb(status)
        }
      },
    }).catch((e: unknown) => {
      promise = undefined
      throw e
    })
    try {
      return await promise
    } finally {
      if (statusCallback) {
        waiting.delete(statusCallback)
      }
    }
  }
}
