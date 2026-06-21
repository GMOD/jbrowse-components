import {
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
} from '@jbrowse/alignments-core'
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
        ctx.textBaseline = 'middle'
        for (const m of markers) {
          ctx.fillStyle = palette.insertionColor
          drawInsertionMarker(ctx, m.xCenter, m.rowTop, m.h, m.length, pxPerBp)
          const type = getInsertionType(m.length, pxPerBp)
          const yMid = Math.round(m.rowTop + m.h / 2)
          // Large insertions get the bp count centered inside the box, exactly
          // like plugin-alignments' insertion label. Width is guaranteed to fit
          // the number by insertionBarWidth(=textWidthForNumber) for 'large'.
          if (type === 'large' && m.h > CHAR_HEIGHT) {
            ctx.fillStyle = 'white'
            ctx.textAlign = 'center'
            ctx.fillText(
              String(m.length),
              m.xCenter,
              yMid,
              CHAR_SIZE_WIDTH * String(m.length).length,
            )
          } else if (
            // Small insertions (the 1px bar + serifs) get a `(N)` length label
            // beside the bar once zoomed in, matching plugin-alignments.
            type === 'small' &&
            pxPerBp >= MIN_PX_PER_BP_FOR_TEXT &&
            m.h >= MIN_HEIGHT_FOR_TEXT
          ) {
            ctx.textAlign = 'left'
            ctx.fillText(`(${m.length})`, m.xCenter + 3, yMid)
          }
        }
      }}
    />
  )
})

export default InsertionsOverlay
