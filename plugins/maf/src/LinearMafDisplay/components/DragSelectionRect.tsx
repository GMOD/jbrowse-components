import React from 'react'

import { alpha, useTheme } from '@mui/material'

export default function DragSelectionRect({
  dragStartX,
  dragEndX,
  dragStartY,
  dragEndY,
  scrollTop,
}: {
  dragStartX: number
  dragEndX: number
  dragStartY: number
  dragEndY: number
  scrollTop: number
}) {
  const theme = useTheme()
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.min(dragStartX, dragEndX),
        top: Math.min(dragStartY, dragEndY) + scrollTop,
        width: Math.abs(dragEndX - dragStartX),
        height: Math.abs(dragEndY - dragStartY),
        backgroundColor: alpha(theme.palette.primary.main, 0.2),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
        pointerEvents: 'none',
      }}
    />
  )
}
