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
 * Thin row-resize strip at the bottom of the conservation band, mirroring
 * `MafCoverageResizeHandle`. Drives `setConservationHeight` and reports "active"
 * (hovered or mid-drag) so the parent can suppress crosshairs/tooltips while
 * dragging continues past the thin strip.
 */
const MafConservationResizeHandle = observer(
  function MafConservationResizeHandle({
    model,
    onActiveChange,
  }: {
    model: LinearMafDisplayModel
    onActiveChange: (active: boolean) => void
  }) {
    const { classes } = useStyles()
    const { showConservation, conservationHeight, rowsTopOffset } = model
    const [hovered, setHovered] = useState(false)
    const [dragging, setDragging] = useState(false)

    useEffect(() => {
      onActiveChange(hovered || dragging)
    }, [hovered, dragging, onActiveChange])

    return showConservation ? (
      <ResizeHandle
        onDrag={n => {
          model.setConservationHeight(Math.max(20, conservationHeight + n))
          return undefined
        }}
        onDragStart={() => {
          setDragging(true)
          // In fit mode the bands eat into the rows area, so resizing restretches
          // every row each frame — suppress the dense letter overlay for the drag
          // (matches the coverage/track-height handles).
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
        style={{ top: rowsTopOffset - 4 }} // straddles the conservation/rows seam
        className={classes.handle}
      />
    ) : null
  },
)

export default MafConservationResizeHandle
