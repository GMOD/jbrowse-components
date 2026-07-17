import { useState } from 'react'

import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { runGenotypeClustering } from '../../runGenotypeClustering.ts'

import type { ReducedModel } from './types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Owns one cluster run's lifecycle: start it, report its status, stop it. Not
 * `useFetch` — that fires off a key and has no cancellation or status channel,
 * whereas this run is button-triggered and stoppable mid-flight.
 */
export function useClusterRun({
  model,
  onSuccess,
}: {
  model: ReducedModel
  onSuccess: () => void
}) {
  const [status, setStatus] = useState<RpcStatus>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [stopToken, setStopToken] = useState<StopToken>()
  const { rpcManager } = getSession(model)

  return {
    status,
    loading,
    error,
    stop: () => {
      if (stopToken) {
        stopStopToken(stopToken)
      }
    },
    run: async () => {
      try {
        setError(undefined)
        setStatus('Initializing')
        setLoading(true)
        const view = getContainingView(model) as LinearGenomeViewModel
        if (view.initialized) {
          const stopToken = createStopToken()
          setStopToken(stopToken)
          await runGenotypeClustering({
            model,
            rpcManager,
            sessionId: getRpcSessionId(model),
            regions: view.dynamicBlocks.contentBlocks,
            stopToken,
            statusCallback: setStatus,
          })
          onSuccess()
        }
      } catch (e) {
        if (!isAbortException(e) && isAlive(model)) {
          console.error(e)
          setError(e)
        }
      } finally {
        setLoading(false)
        setStatus('')
        setStopToken(undefined)
      }
    },
  }
}
