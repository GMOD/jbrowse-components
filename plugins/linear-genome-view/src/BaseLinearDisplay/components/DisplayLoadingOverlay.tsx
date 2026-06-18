import { LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const DisplayLoadingOverlay = observer(function DisplayLoadingOverlay({
  model,
}: {
  model: {
    statusMessage?: string
    statusProgress?: number
    loadingOverlayVisible: boolean
    fetchCanceled?: boolean
    cancelFetchByUser?: () => void
    reload?: () => void
  }
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage}
      progress={model.statusProgress}
      isVisible={model.loadingOverlayVisible}
      canceled={model.fetchCanceled}
      onCancel={
        model.cancelFetchByUser ? () => model.cancelFetchByUser?.() : undefined
      }
      onRetry={model.reload ? () => model.reload?.() : undefined}
    />
  )
})

export default DisplayLoadingOverlay
