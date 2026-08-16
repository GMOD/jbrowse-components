import { createStopTokenRotation, isAbortException } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { StatusChannel, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface DiagonalizeProgressModel extends IStateTreeNode {
  setAwaitingAutoDiagonalize: (arg: boolean) => void
  setDiagonalizeStopToken: (arg?: StopToken) => void
  diagonalizeStatus: StatusChannel
}

/**
 * Drives the auto-diagonalize lifecycle shared by the comparative views: flips
 * the awaiting flag, mints a stop token (so the spinner's Cancel can abort),
 * pipes the RPC's statusCallback into the model for the progress bar, swallows
 * the resulting abort, and clears all three volatiles in `finally`. `run` does
 * the actual reorder with the supplied token + callback. Centralized so both
 * views report progress and cancel identically.
 *
 * The token, the throttled+guarded status sink and the clear all come from
 * `createStopTokenRotation`, one per run rather than one per model — this is not
 * latest-wins (`awaitingAutoDiagonalize` admits one run at a time), so `begin()`
 * has nothing to supersede and the value taken is `end()`: closing the guard
 * before the clear. Hand-written, the guard was `isAlive(model)` alone, which
 * is still true for a run that merely finished — so the last percentage landed
 * on the model a window after the clear, and the next reorder mounted its
 * spinner showing the previous run's "Reordering chromosomes 87%".
 */
export async function withDiagonalizeProgress(
  model: DiagonalizeProgressModel,
  run: (opts: {
    stopToken: StopToken
    statusCallback: StatusCallback
  }) => Promise<void>,
) {
  model.setAwaitingAutoDiagonalize(true)
  const rotation = createStopTokenRotation(model, model.diagonalizeStatus)
  const { stopToken, statusCallback, end } = rotation.begin()
  model.setDiagonalizeStopToken(stopToken)
  try {
    await run({ stopToken, statusCallback })
  } catch (e) {
    if (!isAbortException(e)) {
      console.error(e)
    }
  } finally {
    end()
    // `dispose` outside the isAlive guard, and unconditional: a run that
    // *completed* owns a token nobody will ever stop otherwise, and an unstopped
    // string token is a blob URL plus every AbortController taken against it,
    // retained for the document's life
    rotation.dispose()
    if (isAlive(model)) {
      model.setAwaitingAutoDiagonalize(false)
      model.setDiagonalizeStopToken(undefined)
    }
  }
}
