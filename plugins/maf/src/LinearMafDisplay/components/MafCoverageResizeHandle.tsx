import React, { useEffect, useState } from 'react'

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
 * Thin row-resize strip at the bottom of the coverage band. Drives
 * `setCoverageHeight` via the shared `ResizeHandle` from `@jbrowse/core/ui`
 * (no per-plugin drag plumbing). Reports "active" (hovered or mid-drag) so the
 * parent can suppress crosshairs/tooltips — the drag continues after the cursor
 * leaves the thin strip, so hover alone isn't enough.
 */
const MafCoverageResizeHandle = observer(function MafCoverageResizeHandle({
  model,
  onActiveChange,
}: {
  model: LinearMafDisplayModel
  onActiveChange: (active: boolean) => void
}) {
  const { classes } = useStyles()
  const { showCoverage, coverageHeight } = model
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)

  // The handle is "active" while hovered or mid-drag; the drag continues after
  // the cursor leaves the thin strip, so `dragging` (driven by ResizeHandle's
  // own drag lifecycle) is what keeps tooltips suppressed to mouseup.
  useEffect(() => {
    onActiveChange(hovered || dragging)
  }, [hovered, dragging, onActiveChange])

  return showCoverage ? (
    <ResizeHandle
      onDrag={n => {
        model.setCoverageHeight(Math.max(20, coverageHeight + n))
        return undefined
      }}
      onDragStart={() => {
        setDragging(true)
        // In fit mode the coverage band eats into the rows area, so this drag
        // restretches every row each frame — suppress the dense letter overlay
        // for its duration (matches the track-height handle). In fixed mode
        // rowHeight is unchanged, so there's nothing to suppress.
        if (model.rowHeightMode === 0) {
          model.setResizing(true)
        }
      }}
      onDragEnd={() => {
        setDragging(false)
        model.setResizing(false)
      }}
      onMouseEnter={() => {
        setHovered(true)
      }}
      onMouseLeave={() => {
        setHovered(false)
      }}
      style={{ top: coverageHeight - 4 }} // straddles the coverage/rows seam
      className={classes.handle}
    />
  ) : null
})

export default MafCoverageResizeHandle
