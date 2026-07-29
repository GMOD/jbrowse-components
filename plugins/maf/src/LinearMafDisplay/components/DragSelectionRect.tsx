import { alpha, useTheme } from '@mui/material'

import type { DragRect } from './useDragSelection.ts'

/**
 * The rubberband rectangle for a subsequence selection. Its coordinates are the
 * raw display-relative mouse positions and need no scroll correction: the rows
 * area doesn't scroll, it is *drawn* translated by `-scrollTop` (see
 * `treeDrawingAutorun` / `SvgRowLabels`), so a container-relative px is already
 * where the cursor is. Adding `scrollTop` here pushed the rect that far below the
 * cursor on any scrolled track.
 */
export default function DragSelectionRect({ rect }: { rect: DragRect }) {
  const theme = useTheme()
  const { startX, startY, endX, endY } = rect
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.min(startX, endX),
        top: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        backgroundColor: alpha(theme.palette.primary.main, 0.2),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
        pointerEvents: 'none',
      }}
    />
  )
}
