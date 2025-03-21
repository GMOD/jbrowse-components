import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'

import type { ReducedModel } from './types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ClusterDialogAuto = observer(function ({
  model,
  children,
  handleClose,
  samplesPerPixel,
}: {
  model: ReducedModel
  children: React.ReactNode
  handleClose: () => void
  samplesPerPixel: number
}) {
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<unknown>()
  const [stopToken, setStopToken] = useState('')

  return (
    <>
      <DialogContent>
        {children}
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
              const { sources, adapterConfig } = model
              if (sources) {
                const sessionId = getRpcSessionId(model)
                const stopToken = createStopToken()
                setStopToken(stopToken)
                const ret = (await rpcManager.call(
                  sessionId,
                  'MultiWiggleClusterScoreMatrix',
                  {
                    regions: view.dynamicBlocks.contentBlocks,
                    sources,
                    sessionId,
                    adapterConfig,
                    stopToken,
                    bpPerPx: view.bpPerPx / samplesPerPixel,
                    statusCallback: (arg: string) => {
                      setProgress(arg)
                    },
                  },
                )) as { order: number[] }

                model.setLayout(
                  ret.order.map(idx => {
                    const ret = sources[idx]
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

export default ClusterDialogAuto
