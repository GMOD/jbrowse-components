import { ErrorBar, LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// FetchMixin status surface. Each overlay only Picks the fields it reads.
// `error` is `unknown` to match FetchMixin's volatile (which preserves
// non-Error throws); ErrorBar normalizes at the boundary.
interface DisplayStatusModel {
  error: unknown
  isReady: boolean
  viewportWithinLoadedData: boolean
  regionTooLarge: boolean
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
  model: Pick<
    DisplayStatusModel,
    'statusMessage' | 'isReady' | 'viewportWithinLoadedData' | 'regionTooLarge' | 'error'
  >
}) {
  // Show while loading OR while stale data is on screen (viewport extends past
  // loaded data during the pre-refetch debounce). Suppressed under
  // regionTooLarge/error, which surface their own UI.
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage || 'Loading'}
      isVisible={
        (!model.isReady || !model.viewportWithinLoadedData) &&
        !model.regionTooLarge &&
        !model.error
      }
    />
  )
})
