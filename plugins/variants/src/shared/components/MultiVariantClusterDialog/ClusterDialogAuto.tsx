import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { ReducedModel } from './types.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ClusterDialogAuto = observer(function ClusterDialogAuto({
  model,
  children,
  handleClose,
}: {
  model: ReducedModel
  children: React.ReactNode
  handleClose: () => void
}) {
  const [progress, setProgress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [stopToken, setStopToken] = useState<StopToken>()
  const { rpcManager } = getSession(model)
  const {
    sourcesWithoutLayout,
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    adapterConfig,
  } = model

  return (
    <>
      <DialogContent>
        {children}
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
          disabled={loading || !model.sourcesWithoutLayout}
          onClick={async () => {
            try {
              setError(undefined)
              setProgress('Initializing')
              setLoading(true)
              const view = getContainingView(model) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              if (sourcesWithoutLayout) {
                const sessionId = getRpcSessionId(model)
                const stopToken = createStopToken()
                setStopToken(stopToken)
                const ret = (await rpcManager.call(
                  sessionId,
                  'MultiVariantClusterGenotypeMatrix',
                  {
                    regions: view.dynamicBlocks.contentBlocks,
                    sources: sourcesWithoutLayout,
                    minorAlleleFrequencyFilter,
                    lengthCutoffFilter,
                    sessionId,
                    adapterConfig,
                    stopToken,
                    statusCallback: (arg: string) => {
                      setProgress(arg)
                    },
                  },
                )) as { order: number[]; tree: string }

                model.setLayout(
                  ret.order.map(idx => sourcesWithoutLayout[idx]!),
                  false,
                )
                model.setClusterTree(ret.tree)
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

export default ClusterDialogAuto
