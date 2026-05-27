import type { GridRowId } from '@mui/x-data-grid'

// Move the selected rows up by `by` slots. Selected rows keep their relative
// order; the first row clamps at the top.
export function moveUp<T extends { name: string }>(
  arr: T[],
  sel: GridRowId[],
  by = 1,
) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => a - b)
  let lastIdx = 0
  for (const old of idxs) {
    const idx = Math.max(lastIdx, old - by)
    arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    lastIdx = lastIdx + 1
  }
  return arr
}

// Mirror of moveUp, descending.
export function moveDown<T extends { name: string }>(
  arr: T[],
  sel: GridRowId[],
  by = 1,
) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => b - a)
  let lastIdx = arr.length - 1
  for (const old of idxs) {
    const idx = Math.min(lastIdx, old + by)
    arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    lastIdx = lastIdx - 1
  }
  return arr
}

// Immutable row patch by name. Replaces the in-place `elt.color = c; onChange([...rows])`
// pattern that violates React's "treat state as immutable" rule.
export function updateRows<T extends { name: string }>(
  rows: T[],
  ids: Iterable<GridRowId>,
  patch: Partial<T>,
): T[] {
  const sel = new Set(ids)
  return rows.map(r => (sel.has(r.name) ? { ...r, ...patch } : r))
}

// Field names present on any row, minus a caller-provided reserved set (the
// fields that drive their own dedicated columns). Heterogeneous rows can
// contribute different keys, so union across all rows rather than peeking at
// just the first.
export function extraColumns<T extends object>(
  rows: T[],
  reserved: ReadonlySet<string>,
): string[] {
  const out = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!reserved.has(key)) {
        out.add(key)
      }
    }
  }
  return [...out]
}
