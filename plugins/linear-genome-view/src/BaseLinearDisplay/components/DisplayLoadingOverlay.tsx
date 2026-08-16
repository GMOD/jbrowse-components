import LoadingOverlay from '@jbrowse/core/ui/LoadingOverlay'
import { observer } from 'mobx-react'

import type { DisplayLoadingOverlayModel } from '@jbrowse/display-ui'

// Shape with the contract, re-exported here — see DisplayErrorBar.tsx.
export type { DisplayLoadingOverlayModel }

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
