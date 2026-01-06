import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
  useLocalStorage,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { ReducedModel } from './types.ts'
import type { Source } from '../../../util.ts'
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
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(false)
  const [stopToken, setStopToken] = useState<StopToken>()
  const [showAdvanced, setShowAdvanced] = useState(false)
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
              <span>{progress || 'Loading...'}</span>
              <Button
                onClick={() => {
                  stopStopToken(stopToken)
                }}
              >
                Stop
              </Button>
            </div>
          ) : null}
          {error ? <ErrorMessage error={error} /> : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={loading}
          onClick={async () => {
            try {
              setError(undefined)
              setProgress('Initializing')
              setLoading(true)
              const view = getContainingView(model) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              const { rpcManager } = getSession(model)
              const { sourcesWithoutLayout, adapterConfig } = model
              if (sourcesWithoutLayout) {
                const sessionId = getRpcSessionId(model)
                const stopToken = createStopToken()
                setStopToken(stopToken)
                const ret = (await rpcManager.call(
                  sessionId,
                  'MultiWiggleClusterScoreMatrix',
                  {
                    regions: view.dynamicBlocks.contentBlocks,
                    sources: sourcesWithoutLayout,
                    sessionId,
                    adapterConfig,
                    stopToken,
                    bpPerPx: view.bpPerPx / +samplesPerPixel,
                    statusCallback: (arg: string) => {
                      setProgress(arg)
                    },
                  },
                )) as { order: number[] }

                // Preserve color and other layout customizations
                const currentLayout = model.layout?.length
                  ? model.layout
                  : sourcesWithoutLayout
                const sourcesByName = Object.fromEntries(
                  currentLayout.map((s: Source) => [s.name, s]),
                )

                model.setLayout(
                  ret.order.map(idx => {
                    const sourceItem = sourcesWithoutLayout[idx]
                    if (!sourceItem) {
                      throw new Error(`out of bounds at ${idx}`)
                    }
                    // Preserve customizations from current layout
                    return {
                      ...sourceItem,
                      ...sourcesByName[sourceItem.name],
                    }
                  }),
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
              setProgress('')
              setStopToken('')
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
