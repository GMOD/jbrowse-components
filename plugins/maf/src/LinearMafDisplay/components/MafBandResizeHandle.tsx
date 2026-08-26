import { useState } from 'react'

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
 * Drives `setHeight` via the shared `ResizeHandle` from `@jbrowse/core/ui` and
 * reports "active" (hovered or mid-drag) so the parent can suppress
 * crosshairs/tooltips — the drag continues after the cursor leaves the thin
 * strip, so hover alone isn't enough.
 *
 * In fit mode (`rowHeight === 0`) the band eats into the rows area, so a
 * drag restretches every row each frame — suppress the dense letter overlay for
 * the drag's duration (matches the track-height handle). In fixed mode rowHeight
 * is unchanged, so there's nothing to suppress.
 */
const MafBandResizeHandle = observer(function MafBandResizeHandle({
  model,
  show,
  resize,
  top,
  onActiveChange,
}: {
  model: LinearMafDisplayModel
  show: boolean
  /** one drag delta; the model action reads the band's height itself */
  resize: (distance: number) => void
  top: number
  onActiveChange: (active: boolean) => void
}) {
  const { classes } = useStyles()
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  // A band drag never touches `rowHeight`, so the mode is the same at both ends
  // of the drag: clear `resizing` only if this handle set it, or a drag here
  // cancels the suppression a concurrent track-height drag owns.
  const suppressesLetters = model.rowHeight === 0
  // The same flag the track's own resize handle brackets — it lives on the
  // track, which is what lets two handles share one gesture state.
  const track = getContainingTrack(model)

  return show ? (
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
  ) : null
})

export default MafBandResizeHandle
