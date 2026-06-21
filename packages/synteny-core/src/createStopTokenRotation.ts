import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

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
   * superseded fetch's late status update can't flicker the overlay. Pass it
   * straight as the RPC `statusCallback` arg.
   */
  statusCallback: (status: RpcStatus) => void
}

/**
 * Stop-token rotation for comparative-view displays (dotplot, synteny) whose
 * fetch runs in a bare `autorun` rather than through `FetchMixin.runFetch` —
 * they don't compose the LGV fetch mixins, so they can't reuse it. Each
 * `begin()` aborts the prior fetch's token and returns a fresh one plus an
 * `isCurrent()` guard. It owns ONLY the token mechanics; each display keeps its
 * own loading/error/commit side-effects in its autorun (dotplot stores the
 * token as its loading indicator, synteny clears status in a `finally`), which
 * is why this is a primitive, not a full `runFetch`.
 *
 * This is the closure-based analog of `FetchMixin`'s `activeStopToken` rotation
 * + staleness epoch, and replaces the skeleton that was previously duplicated
 * by hand (flagged with a `// SYNC:` comment) across the two displays'
 * `afterAttach.ts`.
 */
export function createStopTokenRotation(
  self: IAnyStateTreeNode & StatusReporter,
) {
  let currentStopToken: StopToken | undefined
  return {
    begin(): ActiveFetch {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      const stopToken = createStopToken()
      currentStopToken = stopToken
      const isCurrent = () => stopToken === currentStopToken && isAlive(self)
      return {
        stopToken,
        isCurrent,
        statusCallback: status => {
          if (isCurrent()) {
            self.setStatusMessage(status)
          }
        },
      }
    },
    dispose() {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
    },
  }
}
