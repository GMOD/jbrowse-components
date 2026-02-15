import type { GridRowId } from '@mui/x-data-grid'

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
    if (idx >= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    }
    lastIdx = lastIdx + 1
  }

  return arr
}

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
    if (idx <= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    }
    lastIdx = lastIdx - 1
  }

  return arr
}
