import { LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

export interface DisplayLoadingOverlayModel {
  statusMessage?: string
  statusProgress?: number
  fetchCanceled?: boolean
  cancelFetchByUser?: () => void
  reload?: () => void
}

const DisplayLoadingOverlay = observer(function DisplayLoadingOverlay({
  model,
  visible,
}: {
  model: DisplayLoadingOverlayModel
  visible: boolean
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage}
      progress={model.statusProgress}
      isVisible={visible}
      canceled={model.fetchCanceled}
      onCancel={
        model.cancelFetchByUser ? () => model.cancelFetchByUser?.() : undefined
      }
      onRetry={model.reload ? () => model.reload?.() : undefined}
    />
  )
})

export default DisplayLoadingOverlay
