import type { GridRowId } from '@mui/x-data-grid'

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
