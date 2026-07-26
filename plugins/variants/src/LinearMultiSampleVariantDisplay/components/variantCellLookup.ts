// The per-region cell arrays a (feature, row) -> cell lookup needs. A structural
// subset of both `VariantCellData` and its shipped form, so either satisfies it.
export interface CellLookupData {
  cellFeatureIndices: Uint32Array
  cellRowIndices: Uint32Array
  numCells: number
  refCellCount: number
}

// Lower bound of the (featureIndex, rowIndex) key in [lo, hi): the first index
// whose key is >= the target. Valid because each bucket is sorted by that pair
// (computeVariantCells emits cells feature-major/row-minor and partitions them
// stably).
function lowerBound(
  data: CellLookupData,
  lo: number,
  hi: number,
  featureIdx: number,
  rowIndex: number,
) {
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const f = data.cellFeatureIndices[mid]!
    if (
      f < featureIdx ||
      (f === featureIdx && data.cellRowIndices[mid]! < rowIndex)
    ) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

function searchBucket(
  data: CellLookupData,
  lo: number,
  hi: number,
  featureIdx: number,
  rowIndex: number,
) {
  const i = lowerBound(data, lo, hi, featureIdx, rowIndex)
  return i < hi &&
    data.cellFeatureIndices[i] === featureIdx &&
    data.cellRowIndices[i] === rowIndex
    ? i
    : -1
}

/**
 * The cell drawn for `featureIdx` on row `rowIndex`, or -1 if none was.
 *
 * "None was" is the load-bearing case, and why this reads the cell arrays rather
 * than re-deriving: a cell is absent when the sample has no genotype at the site,
 * *or* when its genotype is all-reference and `referenceDrawingMode` is 'skip'
 * (the worker's colour functions return '' and no cell is emitted). Answering
 * from the same arrays the renderer draws from means the hit-test cannot disagree
 * with what is on screen — a predicate that restated the skip rule could.
 *
 * Two buckets because the reorder puts reference cells first so they paint under
 * the alt cells; each is independently sorted, so each gets a binary search.
 * O(log numCells), and it replaces a spatial index that cost 16 bytes per cell.
 */
export function findCellIndex(
  data: CellLookupData,
  featureIdx: number,
  rowIndex: number,
) {
  const { refCellCount, numCells } = data
  const inRef = searchBucket(data, 0, refCellCount, featureIdx, rowIndex)
  return inRef >= 0
    ? inRef
    : searchBucket(data, refCellCount, numCells, featureIdx, rowIndex)
}

/**
 * The rows whose drawn cell covers content-Y `contentY`, nearest the cursor
 * first.
 *
 * Row r occupies [r*rowHeight, r*rowHeight + max(rowHeight, 2)) — the 2px floor
 * mirrors `max(u.rowHeight, 2.0)` in shaders/variant.slang and
 * Canvas2DVariantRenderer. For rowHeight >= 2 that is exactly one row and the
 * band collapses; only sub-pixel rows stack several under one drawn pixel.
 *
 * `nearest` is the row whose own band contains the cursor, which is also the
 * last one painted there, so preferring it makes the pick both cursor-anchored
 * and consistent with what is visibly on top. Walking down to `lowest` keeps
 * sub-pixel rows hoverable when the nearest row happens to have no cell.
 */
export function rowsUnderCursor(contentY: number, rowHeight: number) {
  const drawnHeight = Math.max(rowHeight, 2)
  const nearest = Math.floor(contentY / rowHeight)
  const lowest = Math.floor((contentY - drawnHeight) / rowHeight) + 1
  return { nearest, lowest: Math.max(lowest, 0) }
}
