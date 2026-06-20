import { useState } from 'react'

import { DEFAULT_COL_WIDTH } from './facetedTableStyles.ts'

const MIN_COL_WIDTH = 50

// Tracks per-column width overrides driven by dragging the header resize
// handles, layered over the measured initial widths.
export function useColumnResize(initialWidths: Record<string, number>) {
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const colWidths = { ...initialWidths, ...overrides }

  function onResizeStart(colId: string, e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = colWidths[colId] ?? DEFAULT_COL_WIDTH

    function onMouseMove(ev: MouseEvent) {
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + ev.clientX - startX)
      setOverrides(prev => ({ ...prev, [colId]: newWidth }))
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { colWidths, onResizeStart }
}
