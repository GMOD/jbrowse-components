import LoadingOverlay from '@jbrowse/core/ui/LoadingOverlay'
import { observer } from 'mobx-react'

import type { LoadingProps } from '@jbrowse/display-ui'

const DisplayLoadingOverlay = observer(function DisplayLoadingOverlay({
  visible,
  immediate,
  message,
  progress,
  canceled,
  onCancel,
  onRetry,
}: LoadingProps) {
  return (
    <LoadingOverlay
      statusMessage={message}
      progress={progress}
      isVisible={visible}
      immediate={immediate}
      canceled={canceled}
      onCancel={onCancel}
      onRetry={onRetry}
    />
  )
})

export default DisplayLoadingOverlay
