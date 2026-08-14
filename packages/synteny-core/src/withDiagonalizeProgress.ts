import {
  createGuardedStatusSink,
  createStatusThrottle,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { RpcStatus, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface DiagonalizeProgressModel extends IStateTreeNode {
  setAwaitingAutoDiagonalize: (arg: boolean) => void
  setDiagonalizeStatus: (arg?: RpcStatus) => void
  setDiagonalizeStopToken: (arg?: StopToken) => void
}

/**
 * Drives the auto-diagonalize lifecycle shared by the comparative views: flips
 * the awaiting flag, mints a stop token (so the spinner's Cancel can abort),
 * pipes the RPC's statusCallback into the model for the progress bar, swallows
 * the resulting abort, and clears all three volatiles in `finally`. `run` does
 * the actual reorder with the supplied token + callback. Centralized so both
 * views report progress and cancel identically.
 */
export async function withDiagonalizeProgress(
  model: DiagonalizeProgressModel,
  run: (opts: {
    stopToken: StopToken
    statusCallback: StatusCallback
  }) => Promise<void>,
) {
  model.setAwaitingAutoDiagonalize(true)
  const stopToken = createStopToken()
  model.setDiagonalizeStopToken(stopToken)
  try {
    await run({
      stopToken,
      // The third owner of a progress stream, alongside FetchMixin and
      // createStopTokenRotation: the diagonalize RPC emits at download
      // granularity (~40/s) and every write repaints the reordering spinner, so
      // it needs the same throttled window they use.
      statusCallback: createGuardedStatusSink({
        isCurrent: () => isAlive(model),
        sink: status => {
          model.setDiagonalizeStatus(status)
        },
        // this run is the only stream on this model's status field
        throttle: createStatusThrottle(),
      }),
    })
  } catch (e) {
    if (!isAbortException(e)) {
      console.error(e)
    }
  } finally {
    // outside the isAlive guard, and unconditional: a run that *completed* owns
    // a token nobody will ever stop otherwise, and an unstopped string token is
    // a blob URL plus every AbortController taken against it, retained for the
    // document's life
    stopStopToken(stopToken)
    if (isAlive(model)) {
      model.setAwaitingAutoDiagonalize(false)
      model.setDiagonalizeStatus(undefined)
      model.setDiagonalizeStopToken(undefined)
    }
  }
}
