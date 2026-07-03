import { useState } from 'react'

import { swap } from './importFormUtils.ts'

import type { ImportFormRowData } from './importFormUtils.ts'

// A stable per-row id so React keys follow a row through reorder/remove instead
// of being pinned to the array index.
export interface Row extends ImportFormRowData {
  id: string
}

// Monotonic counter for minting row ids; only needs to be unique within a list.
let rowIdCounter = 0

// Row-list state machine for the import form. Every edit is keyed by the stable
// row id (never the array index) and uses the functional setState form, so no
// handler depends on the array order or a stale rows closure.
export function useImportFormRows(defaultAssembly: string) {
  const newRow = (assembly = defaultAssembly): Row => ({
    id: `row-${rowIdCounter++}`,
    assembly,
    loc: '',
  })
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow()])

  return {
    rows,
    // New rows inherit the last row's assembly: breakpoint views usually
    // compare regions within one assembly, and a mismatched assembly would drop
    // the already-picked shared track.
    addRow() {
      setRows(prev => [...prev, newRow(prev.at(-1)?.assembly)])
    },
    updateRow(id: string, patch: Partial<ImportFormRowData>) {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
    },
    removeRow(id: string) {
      setRows(prev => prev.filter(r => r.id !== id))
    },
    moveRow(id: string, delta: number) {
      setRows(prev => {
        const idx = prev.findIndex(r => r.id === id)
        const target = idx + delta
        return idx === -1 || target < 0 || target >= prev.length
          ? prev
          : swap(prev, idx, target)
      })
    },
  }
}
