import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'

// The per-region cell arrays a (feature, row) -> cell lookup needs. A structural
// subset of the placed payload, so any `Placed<ShippedRegionData>` satisfies it.
//
// Rows here are the **worker's** numbering, not the screen's: the arrays are
// sorted by `(featureIndex, workerRow)` and the binary search below depends on
// that, while `cellRowIndices` on a placed payload has been permuted into screen
// order for the painters. Callers convert the row they are querying with
// `rowUnmap` — one lookup, versus re-sorting the arrays on every reorder.
export interface CellLookupData {
  cellFeatureIndices: Uint32Array
  cellWorkerRowIndices: Uint32Array
  numCells: number
  refCellCount: number
}

// Lower bound of the (featureIndex, workerRow) key in [lo, hi): the first index
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
      (f === featureIdx && data.cellWorkerRowIndices[mid]! < rowIndex)
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
    data.cellWorkerRowIndices[i] === rowIndex
    ? i
    : -1
}

/**
 * The cell drawn for `featureIdx` on worker row `rowIndex`, or -1 if none was.
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
 * Row r occupies [r*rowHeight, r*rowHeight + drawnCellHeightPx(rowHeight)) —
 * the 2px floor is variant.slang's, generated into TS (adr-051), so what is
 * painted and what is pickable are one rule. For rowHeight >= 2 that is exactly
 * one row and the band collapses; only sub-pixel rows stack several under one
 * drawn pixel.
 *
 * **The band is resolved at the centre of the pixel the cursor is in, not at
 * `contentY` itself.** Rasterization fills a pixel when its centre falls inside
 * the rect, so the centre is where the colours the user is picking from were
 * decided; asking at the pixel's top edge answers about a scanline nothing was
 * sampled on, and misses by `0.5 / rowHeight` rows — three of them at the
 * default fit height with 2,504 samples.
 *
 * `nearest` is the row whose own band contains that sample point, which is also
 * the last one painted there, so preferring it makes the pick both
 * cursor-anchored and consistent with what is visibly on top. Walking down to
 * `lowest` keeps sub-pixel rows hoverable when the nearest row happens to have
 * no cell.
 */
export function rowsUnderCursor(contentY: number, rowHeight: number) {
  const drawnHeight = drawnCellHeightPx(rowHeight)
  const sampleY = Math.floor(contentY) + 0.5
  const nearest = Math.floor(sampleY / rowHeight)
  const lowest = Math.floor((sampleY - drawnHeight) / rowHeight) + 1
  return { nearest, lowest: Math.max(lowest, 0) }
}
