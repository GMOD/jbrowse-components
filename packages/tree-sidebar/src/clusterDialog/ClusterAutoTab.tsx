import { ErrorBanner, SubmitCancelActions } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
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
      <SubmitCancelActions
        submitText="Run clustering"
        submitDisabled={loading || !canRun}
        onSubmit={() => {
          void run()
        }}
        onCancel={() => {
          stop()
          handleClose()
        }}
      />
    </>
  )
})

export default ClusterAutoTab
