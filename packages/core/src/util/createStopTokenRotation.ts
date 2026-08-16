import { isAlive } from '@jbrowse/mobx-state-tree'

import { createGuardedStatusSink, createStatusThrottle } from './progress.ts'
import { createStopToken, stopStopToken } from './stopToken.ts'

import type { RpcStatus } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface StatusReporter {
  setStatusMessage: (status?: RpcStatus) => void
  /**
   * `FetchMixin`'s model-wide guarded sink, present on any display composing
   * the LGV fetch mixins. When it is, the rotation reports through it rather
   * than opening a SECOND throttle window on the same status field — which is
   * the thing one-window-per-owner exists to prevent, and which the
   * multi-sample-variant sources fetch had done to a display whose region
   * fetches were already thinning through the mixin's window.
   *
   * Optional because the displays this helper was written for (dotplot,
   * synteny) compose no fetch mixin and have only the window below.
   */
  makeStatusCallback?: (isCurrent: () => boolean) => (status: RpcStatus) => void
  /** `FetchMixin`'s `throttle.runNow`, paired with `makeStatusCallback` */
  flushStatus?: (apply: () => void) => void
}

export interface ActiveFetch {
  /** stop token to forward to the RPC call */
  stopToken: StopToken
  /**
   * True only while this is still the most recent fetch AND `self` is alive.
   * Gate every post-await write — result commit, error set — on it so a
   * superseded or torn-down fetch never writes back.
   */
  isCurrent: () => boolean
  /**
   * RPC `statusCallback` pre-gated by `isCurrent`: forwards progress to
   * `setStatusMessage` only while this is still the latest fetch, so a
   * superseded fetch's late status update can't flicker the overlay, and
   * throttled to the same leading edge as `FetchMixin`'s callbacks. Pass it
   * straight as the RPC `statusCallback` arg.
   */
  statusCallback: (status: RpcStatus) => void
  /**
   * Call in the `finally` of the run that owns this fetch: closes
   * `isCurrent`, drops the write queued behind the throttle, and clears the
   * status field.
   *
   * All three, because a caller doing it by hand got some subset. `isCurrent`
   * is `token === current && isAlive`, and a run that *completes* never rotates
   * its own token — so the guard stays open after the work ends and a trailing
   * write lands on top of a hand-written `setStatusMessage(undefined)` up to a
   * window later. That is the shape `installComparativeFetchAutorun` had; the
   * multi-sample-variant sources fetch had no clear at all and pinned a
   * progress chip on any failure its worker didn't clear for it.
   */
  end: () => void
}

/**
 * Latest-wins stop-token rotation for a fetch that runs in a bare `autorun`
 * rather than through `FetchMixin.runFetch` (which welds the same mechanics to
 * `fetchGeneration`, so it's only for viewport-driven LGV fetches). Each
 * `begin()` aborts the prior fetch's token and returns a fresh one plus an
 * `isCurrent()` guard that captures this run's token — gate every post-await
 * write on it and a superseded or torn-down fetch can never clobber fresher
 * data. The guard is the return value, so a caller can't forget to compare a
 * token by hand.
 *
 * `end()` in the run's `finally` is the other half, and for the same reason:
 * ending a fetch means three things (close the guard, drop the throttle's
 * queued write, clear the status field) and a caller writing them out got a
 * subset. Both callers did — one cleared without dropping the queued write,
 * the other never cleared at all.
 *
 * Owns the token mechanics and the status channel; the caller keeps its own
 * loading/error/commit side-effects in its autorun. Used by any bare-autorun
 * fetch: the comparative-view displays (dotplot, synteny, through
 * `installComparativeFetchAutorun`, which wraps this with their shared
 * debounce/flags/commit skeleton) and the multi-sample-variant sources fetch.
 * The latter is on a display that DOES compose `FetchMixin`, which is what
 * `makeStatusCallback` on the host type is for — see there.
 */
export function createStopTokenRotation(self: IStateTreeNode & StatusReporter) {
  let currentStopToken: StopToken | undefined
  // One window for this display, reopened per fetch so each new fetch reports
  // its first status immediately. Without it these displays wrote an observable
  // per progress event where every mixin-based display thins to 10/s — the
  // overlay repainted faster than the view animated.
  //
  // Unused on a display that composes `FetchMixin`: its window is the model's,
  // so that display has one window rather than two writing one field.
  const throttle = createStatusThrottle()
  const flush = (apply: () => void) => {
    if (self.flushStatus) {
      self.flushStatus(apply)
    } else {
      throttle.runNow(apply)
    }
  }
  const clearStatus = () => {
    flush(() => {
      if (isAlive(self)) {
        self.setStatusMessage(undefined)
      }
    })
  }
  return {
    begin(): ActiveFetch {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      const stopToken = createStopToken()
      currentStopToken = stopToken
      throttle.reset()
      // The superseded fetch's last label describes work that is over, and
      // nothing else drops it: the replacing fetch overwrites it only once its
      // own first status arrives, which for an RPC is after a worker hop.
      // `FetchMixin.runFetch` clears at the start for the same reason.
      clearStatus()
      // `ended` is the term a completed fetch has no other way to express: a
      // SUPERSEDED one is caught by the token comparison, but a fetch that
      // simply finished still holds the current token, so without this its
      // guard stays open and a trailing status write lands after the run that
      // owned it is over. Read by the sink as well as by the caller's commit
      // guard, which is why both go through this one closure.
      let ended = false
      const isCurrent = () =>
        !ended && stopToken === currentStopToken && isAlive(self)
      return {
        stopToken,
        isCurrent,
        statusCallback:
          self.makeStatusCallback?.(isCurrent) ??
          createGuardedStatusSink({
            isCurrent,
            sink: status => {
              self.setStatusMessage(status)
            },
            throttle,
          }),
        end() {
          // Only the run that still owns the field clears it. A SUPERSEDED run
          // reaches its `finally` too — it unwinds on the abort the rotation
          // just raised — and clearing there would wipe the label the fetch
          // that replaced it has already set.
          const owned = isCurrent()
          ended = true
          if (owned) {
            clearStatus()
          }
        },
      }
    },
    dispose() {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      // the throttle outlives the token: a trailing write is queued on a timer,
      // and while the sink's `isCurrent` makes it a no-op rather than a write to
      // a dead node, the timer itself still stands for up to a window past
      // teardown. `FetchMixin.resetStatus` resets for the same reason.
      throttle.reset()
    },
  }
}
