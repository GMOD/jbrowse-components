import React, { useEffect, useState } from 'react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material'
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Source } from '../../util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { isAlive } from 'mobx-state-tree'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

export function toP(s = 0) {
  return +(+s).toPrecision(6)
}

export default function HierarchicalCluster({
  model,
  handleClose,
}: {
  model: {
    sources?: Source[]
    mafFilter: number
    adapterConfig: AnyConfigurationModel
    setLayout: (arg: Source[]) => void
  }
  handleClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ order: number[] }>()
  const [error, setError] = useState<unknown>()
  const [progress, setProgress] = useState<string>('')

  return (
    <Dialog open title="Hierarchical clustering" onClose={handleClose}>
      <DialogContent>
        <Typography>
          This will perform basic agglomerative hierarchical clustering on the
          matrix of currently visible genotype data, which can then sort the
          rows according to the clustering.
        </Typography>
        <Alert severity="warning">
          This is a fairly CPU and memory intensive operation.
        </Alert>
        <Button
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                setLoading(true)
                setError(undefined)
                const view = getContainingView(model) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                const { rpcManager } = getSession(model)
                const { sources, mafFilter, adapterConfig } = model
                // const token = createStopToken()
                // model.setSourcesLoading(token)
                const sessionId = getRpcSessionId(model)
                const ret = (await rpcManager.call(
                  sessionId,
                  'MultiVariantHierarchicalCluster',
                  {
                    regions: view.dynamicBlocks.contentBlocks,
                    sources,
                    mafFilter,
                    sessionId,
                    adapterConfig,
                    statusCallback: (arg: string) => {
                      setProgress(arg)
                    },
                  },
                )) as { order: number[] }
                setResults(ret)
              } catch (e) {
                if (!isAbortException(e) && isAlive(model)) {
                  console.error(e)
                  setError(e)
                }
              } finally {
                setLoading(false)
              }
            })()
          }}
          disabled={loading}
        >
          Perform clustering
        </Button>
        {progress ? <div>Progress: {toP(+progress * 100)}%</div> : null}
        {error ? <ErrorMessage error={error} /> : null}
      </DialogContent>
      <DialogActions>
        <Button
          disabled={!results}
          variant="contained"
          onClick={() => {
            const { sources } = model
            if (results && sources) {
              model.setLayout(results.order.map(idx => sources[idx]!))
            }
            handleClose()
          }}
        >
          Apply clustering to row order
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
