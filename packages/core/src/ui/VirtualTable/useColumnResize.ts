import { useState } from 'react'

const MIN_COL_WIDTH = 50

/**
 * Per-column widths the user dragged a header edge to, layered over the
 * fitted widths; resetting a column drops its own width
 */
export function useColumnResize(initialWidths: Record<string, number>) {
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  return {
    colWidths: { ...initialWidths, ...overrides },
    resized: overrides,
    resize(colId: string, width: number) {
      setOverrides(prev => ({
        ...prev,
        [colId]: Math.max(MIN_COL_WIDTH, width),
      }))
    },
    reset(colId: string) {
      setOverrides(prev =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => id !== colId)),
      )
    },
  }
}
