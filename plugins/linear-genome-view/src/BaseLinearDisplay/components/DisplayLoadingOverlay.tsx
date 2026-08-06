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
  immediate,
}: {
  model: DisplayLoadingOverlayModel
  visible: boolean
  immediate?: boolean
}) {
  // Lands above the LGV's inter-region masks without doing anything about it
  // here: DisplayStatusChromeBase portals the whole overlay group. See there.
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage}
      progress={model.statusProgress}
      isVisible={visible}
      immediate={immediate}
      canceled={model.fetchCanceled}
      onCancel={
        model.cancelFetchByUser ? () => model.cancelFetchByUser?.() : undefined
      }
      onRetry={model.reload ? () => model.reload?.() : undefined}
    />
  )
})

export default DisplayLoadingOverlay
