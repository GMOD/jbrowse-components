import { useEffect, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingTrack } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

const useStyles = makeStyles()({
  handle: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 5,
    cursor: 'row-resize',
    zIndex: 10,
  },
})

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
  resize,
  top,
  onActiveChange,
}: {
  model: LinearMafDisplayModel
  /** one drag delta; the model action reads the band's height itself */
  resize: (distance: number) => void
  top: number
  onActiveChange: (active: boolean) => void
}) {
  const { classes } = useStyles()
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
    <ResizeHandle
      onDrag={n => {
        resize(n)
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
      style={{ top }} // straddles the band/rows seam
      className={classes.handle}
    />
  )
})

export default MafBandResizeHandle
