import { useEffect, useState } from 'react'

import { createStatusWindow, isAbortException } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Owns one cluster run's lifecycle for a "Run clustering" dialog: start it,
 * report its status, stop it, and abort it if the dialog goes away. Not
 * `useFetch` — that fires on a key changing and has no status channel, whereas
 * this run is button-triggered, reports progress, and is stoppable mid-flight
 * from a Cancel button rather than only when the component goes away.
 *
 * `run` does the display-specific RPC with the token and status sink it's
 * handed. It should **throw** for preconditions (an uninitialized view, too few
 * rows to cluster) so they land in the same error state as an RPC failure
 * instead of needing their own branch here.
 *
 * The effect is why this is a hook and not a plain object: aborting an in-flight
 * worker call when the component goes away is cleanup of something outside
 * React. Re-subscribing per token keeps the cleanup holding the live one; the
 * cleanup that fires when a run ends and clears the token stops something
 * already finished, which is a no-op. Dialogs still call `stop()` from their
 * Cancel button — that's the direct expression of the user's intent, and this
 * covers every other way the dialog can disappear (title-bar X, Escape, the
 * display being removed mid-run).
 */
export function useClusterRun({
  model,
  onSuccess,
  run,
}: {
  // read only for `isAlive`: a run that failed because its display went away
  // has no dialog to report an error into
  model: IStateTreeNode
  onSuccess: () => void
  run: (args: {
    stopToken: StopToken
    statusCallback: (arg: RpcStatus) => void
  }) => Promise<void>
}) {
  const [status, setStatus] = useState<RpcStatus>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(false)
  const [stopToken, setStopToken] = useState<StopToken>()

  useEffect(
    () => () => {
      stopStopToken(stopToken)
    },
    [stopToken],
  )

  return {
    status,
    error,
    loading,
    stop: () => {
      stopStopToken(stopToken)
    },
    run: async () => {
      const token = createStopToken()
      setError(undefined)
      setStatus('Initializing')
      setLoading(true)
      // registered before the await, so an unmount mid-run has a live token to
      // abort
      setStopToken(token)
      // Owned like every other progress stream, which this one was not: the
      // clustering RPC reports at download granularity and `setStatus` went
      // straight to React, so every one of those ~40 a second re-rendered the
      // dialog. And nothing narrowed them to the run in flight — an RPC resolves
      // its status channel asynchronously, so one arriving after the `finally`
      // put a finished run's label back under an idle dialog.
      //
      // One window per run, because a run is what it describes.
      let running = true
      const { statusCallback, clear } = createStatusWindow(setStatus).open({
        isCurrent: () => running && isAlive(model),
      })
      try {
        await run({ stopToken: token, statusCallback })
        onSuccess()
      } catch (e) {
        if (!isAbortException(e) && isAlive(model)) {
          console.error(e)
          setError(e)
        }
      } finally {
        // every exit, not just the failures: `onSuccess` closing the dialog is
        // the caller's business, and a hook that only returns to idle when its
        // caller happens to unmount is one reuse away from a dialog stuck
        // showing a finished run's progress bar. The guard closes first so a
        // late status cannot land on top of the clear — which `clear` itself
        // deliberately does not consult.
        running = false
        setLoading(false)
        clear()
        setStopToken(undefined)
      }
    },
  }
}
