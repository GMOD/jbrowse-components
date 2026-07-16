import type { GridRowId } from '@mui/x-data-grid'

// Row fields that identify a source rather than describe it. They drive their
// own handling (join key, hidden columns) so the grid, palettizer, and bulk
// import/export all exclude them from the auto-derived "extra" attribute list.
// Each site spreads from this so a new plumbing field is added in one place.
export const IDENTITY_FIELDS = ['name', 'source', 'baseUri'] as const

// Move the selected rows up by `by` slots. Selected rows keep their relative
// order; the first row clamps at the top.
export function moveUp<T extends { name: string }>(
  arr: readonly T[],
  sel: GridRowId[],
  by = 1,
): T[] {
  const result = [...arr]
  const idxs = sel
    .map(l => result.findIndex(v => v.name === l))
    .filter(idx => idx >= 0)
    .sort((a, b) => a - b)
  let lastIdx = 0
  for (const old of idxs) {
    const idx = Math.max(lastIdx, old - by)
    result.splice(idx, 0, result.splice(old, 1)[0]!)
    lastIdx = lastIdx + 1
  }
  return result
}

// Mirror of moveUp, descending.
export function moveDown<T extends { name: string }>(
  arr: readonly T[],
  sel: GridRowId[],
  by = 1,
): T[] {
  const result = [...arr]
  const idxs = sel
    .map(l => result.findIndex(v => v.name === l))
    .filter(idx => idx >= 0)
    .sort((a, b) => b - a)
  let lastIdx = result.length - 1
  for (const old of idxs) {
    const idx = Math.min(lastIdx, old + by)
    result.splice(idx, 0, result.splice(old, 1)[0]!)
    lastIdx = lastIdx - 1
  }
  return result
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

// Heterogeneous rows can contribute different keys, so union across all rows
// rather than peeking at just the first.
function unionFields<T extends object>(
  rows: T[],
  reserved: ReadonlySet<string>,
  include: (value: unknown) => boolean,
): string[] {
  const out = new Set<string>()
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!reserved.has(key) && include(value)) {
        out.add(key)
      }
    }
  }
  return [...out]
}

// Fields worth giving a column, i.e. carrying a value on at least one row.
//
// A key explicitly assigned `undefined` still shows up in Object.keys, and rows
// are commonly built by mapping a fixed field list (multi-wiggle's setRpcData
// does exactly that), so a field no row has ever set would otherwise render as
// a permanently blank column and offer itself as a palette key that buckets
// every row under ''. Value-presence, not key-presence, is what makes a column.
export function extraColumns<T extends object>(
  rows: T[],
  reserved: ReadonlySet<string>,
): string[] {
  return unionFields(rows, reserved, value => value !== undefined)
}

// Every field a row can carry, whether or not any row has set one. This is the
// row *shape* rather than the row data: the CSV export needs it so a field
// nobody has filled in yet still appears as a header the user can fill in,
// which is how the bulk editor advertises what is settable.
export function allFieldNames<T extends object>(
  rows: T[],
  reserved: ReadonlySet<string>,
): string[] {
  return unionFields(rows, reserved, () => true)
}
