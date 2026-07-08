import { useEffect, useRef, useState } from 'react'

import { ErrorBanner, StatusProgressBar } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
  statusFraction,
  statusProgressLabel,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import SamplesPerPixelField from './SamplesPerPixelField.tsx'
import { useClusterSamplingOptions } from './clusterOptions.ts'
import { runWiggleClustering } from '../../runWiggleClustering.ts'

import type { ReducedModel } from './types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const WiggleClusterDialogAuto = observer(function WiggleClusterDialogAuto({
  model,
  children,
  handleClose,
}: {
  model: ReducedModel
  children: React.ReactNode
  handleClose: () => void
}) {
  const [status, setStatus] = useState<RpcStatus>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(false)
  const [stopToken, setStopToken] = useState<StopToken>()
  const { showAdvanced, setShowAdvanced, samplesPerPixel, setSamplesPerPixel } =
    useClusterSamplingOptions()

  // Abort an in-flight clustering RPC if the dialog is dismissed (title-bar X /
  // Escape) — the explicit Cancel button does this too, but closing any other
  // way would otherwise leave the RPC running. A ref mirrors the active token
  // so the unmount cleanup sees its latest value without re-subscribing.
  const stopTokenRef = useRef<StopToken>(undefined)
  stopTokenRef.current = stopToken
  useEffect(
    () => () => {
      stopStopToken(stopTokenRef.current)
    },
    [],
  )
  return (
    <>
      <DialogContent>
        {children}
        <div style={{ marginTop: 50 }}>
          <Button
            variant="contained"
            onClick={() => {
              setShowAdvanced(!showAdvanced)
            }}
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </Button>
          {showAdvanced ? (
            <SamplesPerPixelField
              value={samplesPerPixel}
              onChange={val => {
                setSamplesPerPixel(val)
              }}
            />
          ) : null}
        </div>
        <div>
          {loading ? (
            <div style={{ padding: 50 }}>
              <span>{statusProgressLabel(status) || 'Loading...'}</span>
              <Button
                variant="contained"
                onClick={() => {
                  stopStopToken(stopToken)
                }}
              >
                Stop
              </Button>
              <StatusProgressBar
                fraction={statusFraction(status)}
                style={{ marginTop: 8 }}
              />
            </div>
          ) : null}
          {error ? <ErrorBanner error={error} /> : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={loading}
          onClick={async () => {
            try {
              setError(undefined)
              const view = getContainingView(model) as LinearGenomeViewModel
              const { sourcesWithoutLayout } = model
              if (!view.initialized) {
                setError(
                  new Error(
                    'The view is not initialized yet, please wait and try again',
                  ),
                )
              } else if (!sourcesWithoutLayout.length) {
                setError(new Error('No subtracks available to cluster'))
              } else {
                setStatus('Initializing')
                setLoading(true)
                const stopToken = createStopToken()
                setStopToken(stopToken)
                await runWiggleClustering({
                  model,
                  rpcManager: getSession(model).rpcManager,
                  sessionId: getRpcSessionId(model),
                  samplesPerPixel,
                  stopToken,
                  statusCallback: (arg: RpcStatus) => {
                    setStatus(arg)
                  },
                })
                handleClose()
              }
            } catch (e) {
              if (!isAbortException(e) && isAlive(model)) {
                console.error(e)
                setError(e)
              }
            } finally {
              setLoading(false)
              setStatus(undefined)
              setStopToken(undefined)
            }
          }}
        >
          Run clustering
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
            if (stopToken) {
              stopStopToken(stopToken)
            }
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default WiggleClusterDialogAuto
