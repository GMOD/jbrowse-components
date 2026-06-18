import { LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const DisplayLoadingOverlay = observer(function DisplayLoadingOverlay({
  model,
}: {
  model: {
    statusMessage?: string
    statusProgress?: number
    loadingOverlayVisible: boolean
    cancelFetch?: () => void
  }
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage}
      progress={model.statusProgress}
      isVisible={model.loadingOverlayVisible}
      onCancel={model.cancelFetch ? () => model.cancelFetch?.() : undefined}
    />
  )
})

export default DisplayLoadingOverlay
