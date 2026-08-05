// How many recoveries a display may attempt before it stops and leaves the
// manual Retry button, and the window those attempts are counted over.
export const MAX_RECOVERIES = 2
export const RECOVERY_WINDOW_MS = 60_000

export type RecoveryVerdict = 'recover' | 'give-up'

/**
 * The recovery budget a display spends re-initializing its rendering backend
 * after a lost WebGL context or a lost WebGPU device.
 *
 * The budget is **windowed, not lifetime**. A context that resolves and then
 * immediately re-loses has to keep climbing toward the cap — that is the flap
 * the cap exists for, and it happens within seconds. But two unrelated losses
 * an hour apart are not a flap, and a lifetime counter cannot tell them apart:
 * it spends the second loss's budget on the first one's and leaves a
 * long-running session permanently unable to auto-recover. Counting over a
 * window separates the two without needing to know which kind of loss it saw.
 *
 * `now` is passed in rather than read, so the caller owns the clock and this
 * stays testable without fake timers.
 */
export class RecoveryBudget {
  private count = 0
  // "No loss yet" — any first `record` yields 1 down either branch, so nothing
  // turns on the value, but -Infinity says it in a way a 0 read off the same
  // clock as `now` does not.
  private lastAt = -Infinity
  private readonly max: number
  private readonly windowMs: number

  constructor(max = MAX_RECOVERIES, windowMs = RECOVERY_WINDOW_MS) {
    this.max = max
    this.windowMs = windowMs
  }

  /**
   * Record a loss and say whether to recover from it. Call this **only when
   * about to act** on the answer — it is a mutation, and calling it
   * speculatively (this hook's recovery effect runs on every render) would
   * refresh the window forever and the count would never lapse.
   */
  record(now: number): RecoveryVerdict {
    this.count = now - this.lastAt > this.windowMs ? 1 : this.count + 1
    this.lastAt = now
    return this.count > this.max ? 'give-up' : 'recover'
  }

  /** Which attempt the loss just recorded is — drives the backoff exponent. */
  get attempt() {
    return this.count
  }

  /**
   * Back to a clean slate, for the two events that mean the trouble is over: a
   * genuine `webglcontextrestored` and a manual Retry. A successful re-init is
   * deliberately NOT one of them — every flap contains one.
   */
  reset() {
    this.count = 0
    this.lastAt = -Infinity
  }
}
