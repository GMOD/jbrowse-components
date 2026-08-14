import { isAlive } from '@jbrowse/mobx-state-tree'

import { createGuardedStatusSink, createStatusThrottle } from './progress.ts'
import { createStopToken, stopStopToken } from './stopToken.ts'

import type { RpcStatus } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface StatusReporter {
  setStatusMessage: (status?: RpcStatus) => void
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
 * Owns ONLY the token mechanics; the caller keeps its own loading/error/commit
 * side-effects in its autorun. Used by any bare-autorun fetch not composing the
 * LGV fetch mixins: the comparative-view displays (dotplot, synteny, through
 * `installComparativeFetchAutorun`, which wraps this with their shared
 * debounce/flags/commit skeleton) and the multi-sample-variant sources fetch.
 */
export function createStopTokenRotation(self: IStateTreeNode & StatusReporter) {
  let currentStopToken: StopToken | undefined
  // One window for this display, reopened per fetch so each new fetch reports
  // its first status immediately. Without it these displays wrote an observable
  // per progress event where every mixin-based display thins to 10/s — the
  // overlay repainted faster than the view animated.
  const throttle = createStatusThrottle()
  return {
    begin(): ActiveFetch {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      const stopToken = createStopToken()
      currentStopToken = stopToken
      throttle.reset()
      const isCurrent = () => stopToken === currentStopToken && isAlive(self)
      return {
        stopToken,
        isCurrent,
        statusCallback: createGuardedStatusSink({
          isCurrent,
          sink: status => {
            self.setStatusMessage(status)
          },
          throttle,
        }),
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
