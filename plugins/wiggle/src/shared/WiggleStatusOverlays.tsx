import { ErrorBar, LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

interface WiggleStatusModel {
  error: Error | null
  isLoading: boolean
  isReady: boolean
  statusMessage?: string
  reload: () => void
}

export const WiggleErrorBar = observer(function WiggleErrorBar({
  model,
}: {
  model: Pick<WiggleStatusModel, 'error' | 'reload'>
}) {
  return model.error ? (
    <ErrorBar
      error={model.error}
      onRetry={() => {
        model.reload()
      }}
    />
  ) : null
})

export const WiggleLoadingOverlay = observer(function WiggleLoadingOverlay({
  model,
}: {
  model: Pick<WiggleStatusModel, 'statusMessage' | 'isReady'>
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage || 'Loading'}
      isVisible={!model.isReady}
    />
  )
})
