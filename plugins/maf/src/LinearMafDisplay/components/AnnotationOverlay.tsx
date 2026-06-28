import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import { drawMafAnnotations } from '../../LinearMafRenderer/rendering/annotations.ts'
import { getFrameColors } from '../../LinearMafRenderer/util.ts'

import type { FrameMarker } from './computeVisibleAnnotations.ts'

// Per-species CDS frame boxes (UCSC mafFrames), drawn on a backend-independent
// Canvas2D layer that composites over the per-species rows exactly like
// SummaryBarsOverlay.
const AnnotationOverlay = observer(function AnnotationOverlay({
  markers,
  width,
  height,
}: {
  markers: FrameMarker[]
  width: number
  height: number
}) {
  const theme = useTheme()
  if (markers.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafAnnotations(ctx, markers, getFrameColors(theme))
      }}
    />
  )
})

export default AnnotationOverlay
