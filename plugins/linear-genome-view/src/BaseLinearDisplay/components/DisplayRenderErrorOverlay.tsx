import ErrorOverlay from '@jbrowse/core/ui/ErrorOverlay'
import GpuFallbackButton from '@jbrowse/core/ui/GpuFallbackButton'
import { observer } from 'mobx-react'

// Full-area overlay for a render-backend (GPU) error, used as a display's
// early-return. Standardizes the width fallback and retry wrapping so the GPU
// displays can't drift on it.
//
// A lost context gets one extra action: retry only helps if GPU capacity has
// freed, so the banner also offers the remedy that always works.
// `GpuFallbackButton` decides whether that applies and renders nothing when it
// does not, so this passes it unconditionally.
const DisplayRenderErrorOverlay = observer(function DisplayRenderErrorOverlay({
  error,
  onRetry,
  height,
}: {
  error: unknown
  onRetry: () => void
  height: number
}) {
  return (
    <ErrorOverlay
      error={error}
      width="100%"
      height={height}
      onRetry={() => {
        onRetry()
      }}
      extraAction={<GpuFallbackButton error={error} onRetry={onRetry} />}
    />
  )
})

export default DisplayRenderErrorOverlay
