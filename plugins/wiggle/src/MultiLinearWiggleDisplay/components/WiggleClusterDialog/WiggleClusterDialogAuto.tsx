import { useEffect, useRef, useState } from 'react'

import { ErrorBanner, StatusProgressBar } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
  statusFraction,
  statusProgressLabel,
  useLocalStorage,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { buildClusteredLayout } from '@jbrowse/tree-sidebar'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { parseSamplesPerPixel } from './parseSamplesPerPixel.ts'

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
  const [showAdvanced, setShowAdvanced] = useLocalStorage(
    'cluster-showAdvanced',
    false,
  )
  const [samplesPerPixel, setSamplesPerPixel] = useLocalStorage(
    'cluster-samplesPerPixel',
    '1',
  )

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
            <div style={{ marginTop: 20 }}>
              <Typography>
                By default this samples the data once per screen pixel across
                the currently visible region.
              </Typography>
              <TextField
                label="Samples per pixel (>1 for denser sampling, between 0-1 for sparser sampling)"
                variant="outlined"
                size="small"
                value={samplesPerPixel}
                onChange={event => {
                  setSamplesPerPixel(event.target.value)
                }}
              />
            </div>
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
              const { sourcesWithoutLayout, adapterConfig } = model
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
                const { rpcManager } = getSession(model)
                const sessionId = getRpcSessionId(model)
                const stopToken = createStopToken()
                setStopToken(stopToken)
                const ret = await rpcManager.call(
                  sessionId,
                  'MultiWiggleClusterScoreMatrix',
                  {
                    regions: view.dynamicBlocks.contentBlocks,
                    sources: sourcesWithoutLayout,
                    adapterConfig,
                    stopToken,
                    bpPerPx:
                      view.bpPerPx / parseSamplesPerPixel(samplesPerPixel),
                    statusCallback: (arg: RpcStatus) => {
                      setStatus(arg)
                    },
                  },
                )

                model.setLayoutAndClusterTree(
                  buildClusteredLayout(
                    sourcesWithoutLayout,
                    model.layout,
                    ret.order,
                  ),
                  ret.tree,
                )
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
