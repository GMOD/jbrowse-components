import { ErrorOverlay } from '@jbrowse/core/ui'
import {
  isGpuRenderingDisabled,
  setGpuOverride,
} from '@jbrowse/render-core/gpuDevice'
import { isGpuContextLostError } from '@jbrowse/render-core/useRenderingBackend'
import { Button, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

// Full-area overlay for a render-backend (GPU) error, used as a display's
// early-return. Standardizes the width fallback and retry wrapping so the GPU
// displays can't drift on it.
//
// A lost context gets one extra action: retry only helps if GPU capacity has
// freed, so the banner also offers the remedy that always works. Page-wide
// because the cause is (a browser cap of ~16 live WebGL contexts, shared by every
// view), and hidden once the GPU is off, where it would be a no-op.
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
      extraAction={
        isGpuContextLostError(error) && !isGpuRenderingDisabled() ? (
          <Tooltip title="Stop using the GPU for the rest of this session and draw with Canvas2D instead. Slower on dense data, but unaffected by how many views are open.">
            <Button
              data-testid="use_canvas2d_button"
              onClick={() => {
                setGpuOverride('canvas2d')
                onRetry()
              }}
            >
              Use Canvas2D
            </Button>
          </Tooltip>
        ) : undefined
      }
    />
  )
})

export default DisplayRenderErrorOverlay
