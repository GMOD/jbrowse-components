import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import { drawMafInsertions } from '../../LinearMafRenderer/rendering/insertions.ts'

import type { InsertionMarker } from './computeVisibleInsertions.ts'
import type { MafColorPalette } from '../../LinearMafRenderer/util.ts'

const InsertionsOverlay = observer(function InsertionsOverlay({
  markers,
  width,
  height,
  palette,
  pxPerBp,
}: {
  markers: InsertionMarker[]
  width: number
  height: number
  palette: MafColorPalette
  pxPerBp: number
}) {
  if (markers.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafInsertions(ctx, markers, palette.insertionColor, pxPerBp)
      }}
    />
  )
})

export default InsertionsOverlay
