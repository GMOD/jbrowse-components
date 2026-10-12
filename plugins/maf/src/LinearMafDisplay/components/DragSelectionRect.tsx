import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { observer } from 'mobx-react'

import type { DragRect } from './useDragSelection.ts'

/**
 * The rubberband rectangle for a subsequence selection. Coordinates are raw
 * display-relative mouse positions with no scroll correction: the rows are
 * drawn translated by `-scrollTop`, so a container-relative px is already where
 * the cursor is.
 */
const DragSelectionRect = observer(function DragSelectionRect({
  rect,
}: {
  rect: DragRect
}) {
  const palette = usePalette()
  const { startX, startY, endX, endY } = rect
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.min(startX, endX),
        top: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        backgroundColor: alpha(palette.accent, 0.2),
        border: `1px solid ${alpha(palette.accent, 0.5)}`,
        pointerEvents: 'none',
      }}
    />
  )
})

export default DragSelectionRect
