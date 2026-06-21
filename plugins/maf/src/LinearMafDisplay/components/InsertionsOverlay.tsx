import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import { drawMafInsertionMarker } from '../../LinearMafRenderer/rendering/insertions.ts'
import { FONT_CONFIG } from '../../LinearMafRenderer/rendering/types.ts'

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
        ctx.font = FONT_CONFIG
        ctx.textBaseline = 'middle'
        for (const m of markers) {
          drawMafInsertionMarker(
            ctx,
            m.xCenter,
            m.rowTop,
            m.h,
            m.length,
            pxPerBp,
            palette.insertionColor,
          )
        }
      }}
    />
  )
})

export default InsertionsOverlay
