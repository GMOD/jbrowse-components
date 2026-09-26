import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'

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
}
