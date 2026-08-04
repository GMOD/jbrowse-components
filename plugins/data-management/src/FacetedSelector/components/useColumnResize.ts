import { useEffect, useRef, useState } from 'react'

import { DEFAULT_COL_WIDTH } from './facetedTableStyles.ts'

const MIN_COL_WIDTH = 50

// Tracks per-column width overrides driven by dragging the header resize
// handles, layered over the measured initial widths.
export function useColumnResize(initialWidths: Record<string, number>) {
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const colWidths = { ...initialWidths, ...overrides }
  // a drag listens on the document, so it outlives the header cell it started
  // from; held here so closing the dialog mid-drag detaches it rather than
  // leaving a listener resizing a column nobody is looking at
  const endDragRef = useRef<() => void>(undefined)
  useEffect(() => () => endDragRef.current?.(), [])

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
      endDragRef.current = undefined
    }
    // a second mousedown without an intervening mouseup would otherwise strand
    // the first drag's listeners
    endDragRef.current?.()
    endDragRef.current = onMouseUp
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { colWidths, onResizeStart }
}
