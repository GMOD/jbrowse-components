import { useState } from 'react'

import { ErrorBanner, StatusProgressBar } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
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
                This procedure samples the data at each 'pixel' across the
                visible by default
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
                onClick={() => {
                  stopStopToken(stopToken)
                }}
              >
                Stop
              </Button>
              <StatusProgressBar status={status} style={{ marginTop: 8 }} />
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
              setStatus('Initializing')
              setLoading(true)
              const view = getContainingView(model) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              const { rpcManager } = getSession(model)
              const { sourcesWithoutLayout, adapterConfig } = model
              if (sourcesWithoutLayout.length) {
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
              }
              handleClose()
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
