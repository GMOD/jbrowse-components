import { createStatusThrottle, isAbortException } from '@jbrowse/core/util'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { RpcStatus, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface DiagonalizeProgressModel extends IAnyStateTreeNode {
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
  // The third owner of a progress stream, alongside FetchMixin and
  // createStopTokenRotation: the diagonalize RPC emits at download granularity
  // (~40/s) and every write repaints the reordering spinner, so it needs the
  // same leading-edge window they use.
  const throttle = createStatusThrottle()
  try {
    await run({
      stopToken,
      statusCallback: s => {
        if (isAlive(model)) {
          throttle.run(() => {
            model.setDiagonalizeStatus(s)
          })
        }
      },
    })
  } catch (e) {
    if (!isAbortException(e)) {
      console.error(e)
    }
  } finally {
    if (isAlive(model)) {
      model.setAwaitingAutoDiagonalize(false)
      model.setDiagonalizeStatus(undefined)
      model.setDiagonalizeStopToken(undefined)
    }
  }
}
