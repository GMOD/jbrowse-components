import { ErrorOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// Full-area overlay for a render-backend (GPU) error, used as a display's
// early-return. Standardizes the width fallback and retry wrapping so the GPU
// displays can't drift on it.
const DisplayRenderErrorOverlay = observer(function DisplayRenderErrorOverlay({
  error,
  onRetry,
  width,
  height,
}: {
  error: unknown
  onRetry: () => void
  width?: number
  height: number
}) {
  return (
    <ErrorOverlay
      error={error}
      width={width ?? '100%'}
      height={height}
      onRetry={() => {
        onRetry()
      }}
    />
  )
})

export default DisplayRenderErrorOverlay
