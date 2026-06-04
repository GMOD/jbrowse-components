import { drawInsertionMarker, getInsertionType } from '@jbrowse/alignments-core'
import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import {
  CHAR_HEIGHT,
  CHAR_SIZE_WIDTH,
  FONT_CONFIG,
} from '../../LinearMafRenderer/rendering/types.ts'

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
        ctx.textAlign = 'center'
        for (const m of markers) {
          ctx.fillStyle = palette.insertionColor
          drawInsertionMarker(ctx, m.xCenter, m.rowTop, m.h, m.length, pxPerBp)
          // Large insertions get the bp count centered inside the box, exactly
          // like plugin-alignments' insertion label. Width is guaranteed to fit
          // the number by insertionBarWidth(=textWidthForNumber) for 'large'.
          if (
            getInsertionType(m.length, pxPerBp) === 'large' &&
            m.h > CHAR_HEIGHT
          ) {
            ctx.fillStyle = 'white'
            ctx.fillText(
              String(m.length),
              m.xCenter,
              m.rowTop + (m.h * 7) / 8,
              CHAR_SIZE_WIDTH * String(m.length).length,
            )
          }
        }
      }}
    />
  )
})

export default InsertionsOverlay
