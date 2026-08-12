import { Button, Tooltip } from '@mui/material'

import {
  GPU_FALLBACK_LABEL,
  GPU_FALLBACK_TOOLTIP,
  disableGpuRendering,
  shouldOfferGpuFallback,
} from './gpuFallback.ts'

/**
 * The "Use Canvas2D" remedy on a GPU error banner, for the MUI chrome.
 *
 * **Renders nothing when the error is not one it fixes**, which is what lets a
 * call site pass it unconditionally as `extraAction` instead of repeating the
 * predicate. Every place that repeated it is a place that could forget it, and
 * two already had.
 */
export default function GpuFallbackButton({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  if (!shouldOfferGpuFallback(error)) {
    return null
  }
  return (
    <Tooltip title={GPU_FALLBACK_TOOLTIP}>
      <Button
        data-testid="use_canvas2d_button"
        onClick={() => {
          disableGpuRendering()
          onRetry()
        }}
      >
        {GPU_FALLBACK_LABEL}
      </Button>
    </Tooltip>
  )
}
