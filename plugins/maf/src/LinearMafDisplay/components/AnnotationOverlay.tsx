import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import { drawMafAnnotations } from '../../LinearMafRenderer/rendering/annotations.ts'

import type { FrameMarker } from './computeVisibleAnnotations.ts'

// Per-species CDS frame boxes (UCSC mafFrames), drawn on a backend-independent
// Canvas2D layer that composites over the per-species rows exactly like
// SummaryBarsOverlay.
const AnnotationOverlay = observer(function AnnotationOverlay({
  markers,
  width,
  height,
  frameColors,
}: {
  markers: FrameMarker[]
  width: number
  height: number
  frameColors: (string | undefined)[]
}) {
  if (markers.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafAnnotations(ctx, markers, frameColors)
      }}
    />
  )
})

export default AnnotationOverlay
