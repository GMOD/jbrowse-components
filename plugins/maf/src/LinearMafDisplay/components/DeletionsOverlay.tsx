import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'
import { measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import { FONT_CONFIG } from '../../LinearMafRenderer/rendering/types.ts'

import type { DeletionMarker } from './computeVisibleDeletions.ts'

/**
 * Draws the deleted-base count centered inside each deletion run (e.g. a `1`
 * in a 1bp deletion) when the run is wide and tall enough to fit the text. The
 * gap cells themselves are already painted by the base pass; this overlay only
 * adds the count label, mirroring the insertion overlay's count text.
 */
const DeletionsOverlay = observer(function DeletionsOverlay({
  markers,
  width,
  height,
}: {
  markers: DeletionMarker[]
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
        ctx.font = FONT_CONFIG
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'white'
        for (const m of markers) {
          const text = String(m.length)
          if (m.width >= measureText(text) + 2 && m.h >= MIN_HEIGHT_FOR_TEXT) {
            ctx.fillText(
              text,
              m.xLeft + m.width / 2,
              Math.round(m.rowTop + m.h / 2),
            )
          }
        }
      }}
    />
  )
})

export default DeletionsOverlay
