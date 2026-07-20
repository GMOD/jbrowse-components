import { colorLongreadInv } from '@jbrowse/core/ui/theme'
import { observer } from 'mobx-react'

import { drawInversions } from '../../LinearMafRenderer/rendering/inversions.ts'
import OverlayCanvas from './OverlayCanvas.tsx'

import type { InversionMarker } from './computeVisibleInversions.ts'

/**
 * Overlay marking blocks that align inverted relative to their scaffold's
 * consensus orientation (the strand-flip SV indicator). Composes on top of the
 * active rows rendering, so inversions are visible without changing mode.
 */
const InversionsOverlay = observer(function InversionsOverlay({
  markers,
  width,
  height,
}: {
  markers: InversionMarker[]
  width: number
  height: number
}) {
  if (markers.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawInversions(ctx, markers, colorLongreadInv)
      }}
    />
  )
})

export default InversionsOverlay
