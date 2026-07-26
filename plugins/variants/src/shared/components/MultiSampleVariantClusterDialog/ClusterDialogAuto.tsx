import { ErrorBanner } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ClusterProgress, useClusterRun } from '@jbrowse/tree-sidebar'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { runGenotypeClustering } from '../../runGenotypeClustering.ts'

import type { ReducedModel } from './types.ts'
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
  const { status, loading, error, run, stop } = useClusterRun({
    model,
    onSuccess: () => {
      handleClose()
    },
    run: async ({ stopToken, statusCallback }) => {
      const view = getContainingView(model) as LinearGenomeViewModel
      if (!view.initialized) {
        throw new Error(
          'The view is not initialized yet, please wait and try again',
        )
      }
      await runGenotypeClustering({
        model,
        rpcManager: getSession(model).rpcManager,
        sessionId: getRpcSessionId(model),
        regions: view.dynamicBlocks.contentBlocks,
        stopToken,
        statusCallback,
      })
    },
  })
  const { sourcesVolatile, renderingMode } = model
  const isHaplotypeClustering = renderingMode === 'phased'

  return (
    <>
      <DialogContent>
        {children}
        {isHaplotypeClustering ? (
          <div style={{ marginTop: 8, fontStyle: 'italic' }}>
            Note: Clustering by individual haplotypes (phased mode)
          </div>
        ) : null}
        <div>
          {loading ? (
            <ClusterProgress
              status={status}
              onStop={() => {
                stop()
              }}
            />
          ) : null}
          {error ? <ErrorBanner error={error} /> : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={loading || !sourcesVolatile}
          onClick={() => {
            void run()
          }}
        >
          Run clustering
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            stop()
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default ClusterDialogAuto
