import { getContainingTrack } from '@jbrowse/core/util'
import { BandSeamHandle } from '@jbrowse/display-kit/BandSeamHandle'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Thin row-resize strip at the bottom of a MAF band (coverage or conservation).
 * The display's pointer tracking drops the pointer while it is on the strip, so
 * no crosshair or tooltip follows a resize.
 *
 * In fit mode (`rowHeight === 0`) the band eats into the rows area, so a drag
 * restretches every row each frame; the drag suppresses the dense letter
 * overlay, as the track-height handle does.
 */
const MafBandResizeHandle = observer(function MafBandResizeHandle({
  model,
  height,
  setHeight,
  seam,
}: {
  model: LinearMafDisplayModel
  height: number
  setHeight: (height: number) => void
  seam: number
}) {
  // Clear `resizing` only if this handle set it, or a drag here cancels the
  // suppression a concurrent track-height drag owns.
  const suppressesLetters = model.rowHeight === 0
  // Same flag as the track's resize handle; it lives on the track so two
  // handles share one gesture state.
  const track = getContainingTrack(model)

  return (
    <BandSeamHandle
      seam={seam}
      value={height}
      onChange={h => {
        setHeight(h)
      }}
      onDragStart={() => {
        if (suppressesLetters) {
          track.setResizing(true)
        }
      }}
      onDragEnd={() => {
        if (suppressesLetters) {
          track.setResizing(false)
        }
      }}
    />
  )
})

export default MafBandResizeHandle
