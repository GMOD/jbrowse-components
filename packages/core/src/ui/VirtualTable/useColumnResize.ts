import { useState } from 'react'

const MIN_COL_WIDTH = 50

export interface DraggedWidths {
  widths: Record<string, number>
  setWidths: (widths: Record<string, number>) => void
}

/**
 * Per-column widths the user dragged a header edge to, layered over the
 * fitted widths; resetting a column drops its own width. Kept by the table
 * unless the caller holds them, so they outlive the table
 */
export function useColumnResize(
  initialWidths: Record<string, number>,
  dragged?: DraggedWidths,
) {
  const [ownWidths, setOwnWidths] = useState<Record<string, number>>({})
  const overrides = dragged?.widths ?? ownWidths
  const setOverrides = dragged?.setWidths ?? setOwnWidths
  return {
    colWidths: { ...initialWidths, ...overrides },
    resized: overrides,
    resize(colId: string, width: number) {
      setOverrides({
        ...overrides,
        [colId]: Math.max(MIN_COL_WIDTH, width),
      })
    },
    reset(colId: string) {
      setOverrides(
        Object.fromEntries(
          Object.entries(overrides).filter(([id]) => id !== colId),
        ),
      )
    },
  }
}
