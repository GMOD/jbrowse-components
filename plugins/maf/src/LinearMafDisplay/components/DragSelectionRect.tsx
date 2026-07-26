import React from 'react'

import { alpha, useTheme } from '@mui/material'

/**
 * The rubberband rectangle for a subsequence selection. Its coordinates are the
 * raw display-relative mouse positions and need no scroll correction: the rows
 * area doesn't scroll, it is *drawn* translated by `-scrollTop` (see
 * `treeDrawingAutorun` / `SvgRowLabels`), so a container-relative px is already
 * where the cursor is. Adding `scrollTop` here pushed the rect that far below the
 * cursor on any scrolled track.
 */
export default function DragSelectionRect({
  dragStartX,
  dragEndX,
  dragStartY,
  dragEndY,
}: {
  dragStartX: number
  dragEndX: number
  dragStartY: number
  dragEndY: number
}) {
  const theme = useTheme()
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.min(dragStartX, dragEndX),
        top: Math.min(dragStartY, dragEndY),
        width: Math.abs(dragEndX - dragStartX),
        height: Math.abs(dragEndY - dragStartY),
        backgroundColor: alpha(theme.palette.primary.main, 0.2),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
        pointerEvents: 'none',
      }}
    />
  )
}
