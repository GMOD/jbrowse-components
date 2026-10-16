import LoadingOverlay from '@jbrowse/core/ui/LoadingOverlay'
import { observer } from 'mobx-react'

import type { DisplayLoadingOverlayModel } from '@jbrowse/display-ui'

const DisplayLoadingOverlay = observer(function DisplayLoadingOverlay({
  model,
  visible,
  immediate,
}: {
  model: DisplayLoadingOverlayModel
  visible: boolean
  immediate?: boolean
}) {
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
