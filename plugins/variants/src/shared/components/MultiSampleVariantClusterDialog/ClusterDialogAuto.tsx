import { ErrorBanner } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import ClusterProgress from './ClusterProgress.tsx'
import { useClusterRun } from './useClusterRun.ts'

import type { ReducedModel } from './types.ts'

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
    onSuccess: handleClose,
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
          {loading ? <ClusterProgress status={status} onStop={stop} /> : null}
          {error ? <ErrorBanner error={error} /> : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={loading || !sourcesVolatile}
          onClick={run}
        >
          Run clustering
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
            stop()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default ClusterDialogAuto
