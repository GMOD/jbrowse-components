import { LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const DisplayLoadingOverlay = observer(function DisplayLoadingOverlay({
  model,
}: {
  model: { statusMessage?: string; loadingOverlayVisible: boolean }
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage}
      isVisible={model.loadingOverlayVisible}
    />
  )
})

export default DisplayLoadingOverlay
