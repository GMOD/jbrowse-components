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
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { ReducedModel } from './types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const WiggleClusterDialogAuto = observer(function ({
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
  const [stopToken, setStopToken] = useState('')
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
          {progress ? (
            <div style={{ padding: 50 }}>
              <span style={{ width: 400 }}>Progress: {progress}</span>
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
          onClick={async () => {
            try {
              setError(undefined)
              setProgress('')
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

                model.setLayout(
                  ret.order.map(idx => {
                    const ret = sourcesWithoutLayout[idx]
                    if (!ret) {
                      throw new Error(`out of bounds at ${idx}`)
                    }
                    return ret
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
