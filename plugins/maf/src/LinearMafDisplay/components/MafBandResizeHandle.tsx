import { useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
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
 * In fit mode (`rowHeightMode === 0`) the band eats into the rows area, so a
 * drag restretches every row each frame — suppress the dense letter overlay for
 * the drag's duration (matches the track-height handle). In fixed mode rowHeight
 * is unchanged, so there's nothing to suppress.
 */
const MafBandResizeHandle = observer(function MafBandResizeHandle({
  model,
  show,
  height,
  setHeight,
  top,
  onActiveChange,
}: {
  model: LinearMafDisplayModel
  show: boolean
  height: number
  setHeight: (arg: number) => void
  top: number
  onActiveChange: (active: boolean) => void
}) {
  const { classes } = useStyles()
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)

  return show ? (
    <ResizeHandle
      onDrag={n => {
        setHeight(Math.max(20, height + n))
        return undefined
      }}
      onDragStart={() => {
        setDragging(true)
        onActiveChange(true)
        if (model.rowHeightMode === 0) {
          model.setResizing(true)
        }
      }}
      onDragEnd={() => {
        setDragging(false)
        onActiveChange(hovered)
        model.setResizing(false)
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
