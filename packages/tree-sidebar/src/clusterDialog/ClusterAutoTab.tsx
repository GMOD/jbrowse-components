import { ErrorBanner } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import ClusterProgress from '../ClusterProgress.tsx'
import { useClusterRun } from '../useClusterRun.ts'
import ClusterAdvancedOptions from './ClusterAdvancedOptions.tsx'

import type { ClusterDialogProps } from './types.ts'

// "Run clustering": the in-app hclust path. Everything here is the lifecycle
// `useClusterRun` owns; the display contributes only `run` and `canRun`.
const ClusterAutoTab = observer(function ClusterAutoTab({
  model,
  handleClose,
  canRun,
  run: runClustering,
  advancedOptions,
  children,
}: ClusterDialogProps & { children: React.ReactNode }) {
  const { status, loading, error, run, stop } = useClusterRun({
    model,
    onSuccess: () => {
      handleClose()
    },
    run: runClustering,
  })
  return (
    <>
      <DialogContent>
        {children}
        <ClusterAdvancedOptions>{advancedOptions}</ClusterAdvancedOptions>
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
          disabled={loading || !canRun}
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

export default ClusterAutoTab
