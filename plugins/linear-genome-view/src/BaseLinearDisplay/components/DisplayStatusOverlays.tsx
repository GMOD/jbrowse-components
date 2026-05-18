import { ErrorBar, LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// FetchMixin status surface. Each overlay only Picks the fields it reads.
interface DisplayStatusModel {
  error: Error | null
  isReady: boolean
  statusMessage?: string
  reload: () => void
}

export const DisplayErrorBar = observer(function DisplayErrorBar({
  model,
}: {
  model: Pick<DisplayStatusModel, 'error' | 'reload'>
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

export const DisplayLoadingOverlay = observer(function DisplayLoadingOverlay({
  model,
}: {
  model: Pick<DisplayStatusModel, 'statusMessage' | 'isReady'>
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage || 'Loading'}
      isVisible={!model.isReady}
    />
  )
})
