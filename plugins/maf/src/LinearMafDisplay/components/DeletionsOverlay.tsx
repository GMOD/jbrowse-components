import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { drawMafDeletionLabels } from '../../LinearMafRenderer/rendering/deletions.ts'

import type { MafColorPalette } from '../../LinearMafRenderer/util.ts'
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
  palette,
}: {
  markers: DeletionMarker[]
  width: number
  height: number
  // the label reads against `gapColor`, which the base pass fills the run with
  palette: MafColorPalette
}) {
  if (markers.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafDeletionLabels(ctx, markers, palette)
      }}
    />
  )
})

export default DeletionsOverlay
