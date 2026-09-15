import {
  createAbortRotation,
  getNotificationSink,
  isAbortException,
} from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { StatusChannel, StatusCallback } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface DiagonalizeProgressModel extends IStateTreeNode {
  setAwaitingAutoDiagonalize: (arg: boolean) => void
  setDiagonalizeCancel: (arg?: () => void) => void
  diagonalizeStatus: StatusChannel
}

/**
 * Drives the auto-diagonalize lifecycle shared by the comparative views: flips
 * the awaiting flag, hands the model a cancel (so the spinner's Cancel can
 * abort), pipes the RPC's statusCallback into the model for the progress bar,
 * swallows the resulting abort, and clears all three volatiles in `finally`.
 * `run` does the actual reorder with the supplied signal + callback.
 * Centralized so the views report progress, failure and cancel identically.
 *
 * The signal, the throttled+guarded status sink and the clear all come from
 * `createAbortRotation`, one per run rather than one per model — this is not
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
    signal: AbortSignal
    statusCallback: StatusCallback
  }) => Promise<void>,
) {
  model.setAwaitingAutoDiagonalize(true)
  const rotation = createAbortRotation(model, model.diagonalizeStatus)
  const { signal, statusCallback, end } = rotation.begin()
  model.setDiagonalizeCancel(rotation.cancel)
  try {
    await run({ signal, statusCallback })
  } catch (e) {
    if (!isAbortException(e)) {
      console.error(e)
      if (isAlive(model)) {
        getNotificationSink(model).notifyError(
          `Reordering chromosomes failed: ${e}`,
          e,
        )
      }
    }
  } finally {
    end()
    rotation.dispose()
    if (isAlive(model)) {
      model.setAwaitingAutoDiagonalize(false)
      model.setDiagonalizeCancel(undefined)
    }
  }
}
