import { useEffect, useState } from 'react'

import { getContainingTrack } from '@jbrowse/core/util'
import { BandSeamHandle } from '@jbrowse/display-kit/BandSeamHandle'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Thin row-resize strip at the bottom of a MAF band (coverage or conservation).
 * Drives `setHeight` via the shared `ResizeHandle` and reports "active"
 * (hovered or mid-drag) so the parent can suppress crosshairs and tooltips.
 *
 * In fit mode (`rowHeight === 0`) the band eats into the rows area, so a drag
 * restretches every row each frame; the drag suppresses the dense letter
 * overlay, as the track-height handle does.
 *
 * Mounted only while its band draws. A band hidden under the pointer (a zoom
 * onto the summary tier) sends no mouseleave, so unmounting reports inactive.
 */
const MafBandResizeHandle = observer(function MafBandResizeHandle({
  model,
  height,
  setHeight,
  seam,
  onActiveChange,
}: {
  model: LinearMafDisplayModel
  height: number
  setHeight: (height: number) => void
  seam: number
  onActiveChange: (active: boolean) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  // Clear `resizing` only if this handle set it, or a drag here cancels the
  // suppression a concurrent track-height drag owns.
  const suppressesLetters = model.rowHeight === 0
  // Same flag as the track's resize handle; it lives on the track so two
  // handles share one gesture state.
  const track = getContainingTrack(model)
  useEffect(
    () => () => {
      onActiveChange(false)
    },
    [onActiveChange],
  )

  return (
    <BandSeamHandle
      seam={seam}
      value={height}
      onChange={h => {
        setHeight(h)
      }}
      onDragStart={() => {
        setDragging(true)
        onActiveChange(true)
        if (suppressesLetters) {
          track.setResizing(true)
        }
      }}
      onDragEnd={() => {
        setDragging(false)
        onActiveChange(hovered)
        if (suppressesLetters) {
          track.setResizing(false)
        }
      }}
      onMouseEnter={() => {
        setHovered(true)
        onActiveChange(true)
      }}
      onMouseLeave={() => {
        setHovered(false)
        onActiveChange(dragging)
      }}
    />
  )
})

export default MafBandResizeHandle
