import { useEffect, useState } from 'react'

import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { runWiggleClustering } from '../../runWiggleClustering.ts'

import type { ReducedModel } from './types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Owns one cluster run's lifecycle: start it, report its status, stop it. Not
 * `useFetch` — that fires off a key and has no cancellation or status channel,
 * whereas this run is button-triggered and stoppable mid-flight. Preconditions
 * throw so they land in the same error state as an RPC failure.
 *
 * The one effect is here rather than in the dialog so the dialog stays
 * presentational: aborting an in-flight RPC when the component goes away is
 * cleanup of something outside React (a worker call), which is what an effect
 * is for. Re-subscribing per token keeps the cleanup holding the live one; the
 * cleanup that fires when a run ends and clears the token stops something
 * already finished, which is a no-op.
 */
export function useWiggleClusterRun({
  model,
  samplesPerPixel,
  onSuccess,
}: {
  model: ReducedModel
  samplesPerPixel: string
  onSuccess: () => void
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
      try {
        setError(undefined)
        setStatus('Initializing')
        setLoading(true)
        setStopToken(token)
        const view = getContainingView(model) as LinearGenomeViewModel
        if (!view.initialized) {
          throw new Error(
            'The view is not initialized yet, please wait and try again',
          )
        }
        if (model.sourcesWithoutLayout.length < 2) {
          throw new Error('Need at least two subtracks to cluster')
        }
        await runWiggleClustering({
          model,
          rpcManager: getSession(model).rpcManager,
          sessionId: getRpcSessionId(model),
          samplesPerPixel,
          stopToken: token,
          statusCallback: setStatus,
        })
        // success unmounts the dialog, so there is no progress state left to
        // reset — only the catch below (a real error, or Stop) has a dialog to
        // put back in order
        onSuccess()
      } catch (e) {
        setLoading(false)
        setStatus(undefined)
        setStopToken(undefined)
        if (!isAbortException(e) && isAlive(model)) {
          console.error(e)
          setError(e)
        }
      }
    },
  }
}
