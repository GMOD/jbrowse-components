import ErrorOverlay from '@jbrowse/core/ui/ErrorOverlay'
import GpuFallbackButton from '@jbrowse/core/ui/GpuFallbackButton'
import { observer } from 'mobx-react'

import type { RenderErrorProps } from '@jbrowse/display-ui'

// A lost context also offers the Canvas2D fallback, since Retry only helps once
// GPU capacity frees; `GpuFallbackButton` renders nothing for other errors.
const DisplayRenderErrorOverlay = observer(function DisplayRenderErrorOverlay({
  error,
  onRetry,
  height,
}: RenderErrorProps) {
  return (
    <ErrorOverlay
      error={error}
      width="100%"
      height={height}
      onRetry={onRetry}
      extraAction={<GpuFallbackButton error={error} onRetry={onRetry} />}
    />
  )
})

export default DisplayRenderErrorOverlay
