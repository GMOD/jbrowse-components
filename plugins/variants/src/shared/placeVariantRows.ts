/**
 * A placed payload: `cellRowIndices` now holds *screen* rows, and the worker's
 * own numbering is kept alongside because the sort order depends on it.
 */
export type Placed<T> = T & {
  // The rows as the worker numbered them. The cell arrays are sorted by
  // `(featureIndex, rowIndex)` in THIS numbering — `findCellIndex` binary-
  // searches that order — and a screen order is an arbitrary permutation of it,
  // so the placed array cannot answer the hit test. Kept rather than recovered
  // through the inverse map at query time so the two never disagree about which
  // array a given index belongs to.
  cellWorkerRowIndices: Uint32Array
}

/**
 * Assign each worker row its on-screen row index.
 *
 * The worker names its rows (`rowNames`) and knows nothing about display order,
 * so this is where a fetched cell becomes a *placed* cell. Placement runs
 * against `rowRemap` — the same `rowNames`→row projection the whole display
 * derives from `sources` — so the cells and the sidebar labels can't disagree
 * about which row is which. It is also what lets a reorder, a regroup, a
 * clustering run or a genotype sort re-place cached data instead of refetching
 * it: none of them changes a single byte the worker produced.
 *
 * Rows the display isn't drawing land on `HIDDEN_ROW` rather than being dropped
 * — see that constant for why nothing downstream needs to test for it.
 *
 * Shared by both multi-sample variant displays: the regular display places one
 * of these per region, the matrix places its single payload.
 */
export function placeVariantRows<
  T extends { cellRowIndices: Uint32Array; numCells: number },
>(data: T, rowRemap: Uint32Array): Placed<T> {
  const { cellRowIndices, numCells } = data
  const placed = new Uint32Array(numCells)
  // Unbounded index, deliberately: `rowRemap` is derived from the same
  // `cellData` this payload came out of, so it always has one entry per worker
  // row and the lookup cannot miss. A guard here would only add a branch to a
  // loop that runs once per cell.
  for (let i = 0; i < numCells; i++) {
    placed[i] = rowRemap[cellRowIndices[i]!]!
  }
  return {
    ...data,
    cellRowIndices: placed,
    cellWorkerRowIndices: cellRowIndices,
  }
}
