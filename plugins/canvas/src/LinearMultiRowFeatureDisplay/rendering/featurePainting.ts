import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './multiRowRenderingBackendTypes.ts'

// The region's data if it carries a delta per feature, else undefined (nothing
// to annotate, so the indel overlay skips the block entirely and the hit test
// reports no delta). Named because the test it performs is not the obvious one:
// `featureDeltas` is EMPTY, not zero-filled, when the `lengthField` slot is
// unset — see `featureDeltas` in the RPC result type — so "has deltas" is a
// length agreement with `featureStarts`, and every per-feature
// `featureDeltas[i]!` read is only sound once it holds.
export function regionWithDeltas(data: MultiRowRegionData | undefined) {
  return data && data.featureDeltas.length === data.featureStarts.length
    ? data
    : undefined
}

// Resolve each region-local partition value to its global display-row index
// (undefined = a row not currently shown), so the per-feature lookup in the hot
// loop is an array index rather than a string-keyed Map.get.
//
// Exported for the legend, which asks the inverse question of the walkers below
// — it wants the rows that *do* carry a per-row color override, so it can leave
// them out. Everything that draws or hit-tests goes through this module instead.
export function resolveLocalRowIndices(
  partitionValues: string[],
  rowIndexByValue: ReadonlyMap<string, number>,
): (number | undefined)[] {
  return partitionValues.map(v => rowIndexByValue.get(v))
}

/**
 * Everything needed to answer "does feature `i` paint, and in what color" for
 * one region, resolved once so the per-feature answer is array reads.
 *
 * Held apart from the walkers so a caller can decide where it comes from: the
 * painters build one per region per draw, while the model memoizes them (the
 * hit test runs per pointer frame and would otherwise rebuild `rowForLocal`
 * sixty times a second).
 */
interface DrawnFeatureContext {
  rowForLocal: readonly (number | undefined)[]
  rowColorsByIndex: readonly (number | undefined)[]
  hiddenColors: ReadonlySet<number>
}

export function drawnFeatureContext(
  data: Pick<MultiRowRegionData, 'partitionValues'>,
  state: MultiRowFeaturePaintInputs,
): DrawnFeatureContext {
  return {
    rowForLocal: resolveLocalRowIndices(
      data.partitionValues,
      state.rowIndexByValue,
    ),
    rowColorsByIndex: state.rowColorsByIndex,
    hiddenColors: state.hiddenColors,
  }
}

/**
 * The global display row feature `i` paints on, or undefined when it
 * contributes no pixels — its partition value has no row on screen (filtered
 * out, or not yet discovered), or it is painted in a legend category the user
 * toggled off.
 *
 * Private because no caller should ask this on its own: paired with the color
 * it is the whole of what a consumer needs, and the two walkers below hand over
 * both at once.
 */
function drawnRowAt(
  data: Pick<MultiRowRegionData, 'featurePartitionIndex' | 'featureColors'>,
  ctx: DrawnFeatureContext,
  i: number,
) {
  const rowIndex = ctx.rowForLocal[data.featurePartitionIndex[i]!]
  if (rowIndex === undefined) {
    return undefined
  }
  // The hidden-category test applies only to rows painting the *baked* color. A
  // row with a per-row override paints the override, which the legend never
  // lists (buildColorLegend leaves those rows out), so a baked color that
  // happens to equal a hidden category must not hide it. This is the rule that
  // reads backwards when a caller forgets the override list, which is why the
  // two are read together here and nowhere else.
  return ctx.rowColorsByIndex[rowIndex] === undefined &&
    ctx.hiddenColors.has(data.featureColors[i]!)
    ? undefined
    : rowIndex
}

/**
 * Walk the features that actually paint, in paint order, handing each one its
 * display row and the ABGR color it paints in — the row's own color where it
 * has one (which is what lets a recolor repaint with no refetch), else the
 * worker-baked per-feature color.
 *
 * The three painters — the GPU encode, the Canvas2D fallback and the indel
 * -glyph overlay — differ only in what they do with `(i, rowIndex, color)`, and
 * before this each re-derived which features to skip out of the shared pieces.
 * Sharing the pieces was not enough: what drifts is the composition, and every
 * way to get it wrong is silent rather than loud. A painter that drops the
 * hidden-category test paints a category the legend says is off; one that drops
 * the row check paints an out-of-range lane.
 *
 * Scalar in, scalar out, one closure per region per draw — the same rule
 * `forEachClippedBlock` follows for the per-block scaffold one level up.
 */
export function forEachDrawnFeature(
  data: Pick<
    MultiRowRegionData,
    'featureStarts' | 'featurePartitionIndex' | 'featureColors'
  >,
  ctx: DrawnFeatureContext,
  visit: (i: number, rowIndex: number, color: number) => void,
) {
  for (let i = 0; i < data.featureStarts.length; i++) {
    const rowIndex = drawnRowAt(data, ctx, i)
    if (rowIndex !== undefined) {
      visit(
        i,
        rowIndex,
        ctx.rowColorsByIndex[rowIndex] ?? data.featureColors[i]!,
      )
    }
  }
}

/**
 * The drawn features of one region, bucketed by the display row they paint on:
 * row `r`'s feature indices are `indices[rowStart[r] .. rowStart[r + 1])`, in
 * ascending order, which is paint order.
 *
 * A compressed-row layout (two flat typed arrays) rather than an array of
 * arrays, because the row count is the thing that grows here — a cohort
 * painting is a couple of thousand rows — and one sub-array each is a couple of
 * thousand allocations to answer a question about one of them.
 *
 * Built where the caller can memoize it: the hit test is the only consumer and
 * it runs per pointer frame, while the three painters walk every feature in
 * array order and want `forEachDrawnFeature` instead.
 */
export interface DrawnFeaturesByRow {
  rowStart: Int32Array
  indices: Int32Array
}

export function drawnFeaturesByRow(
  data: Pick<
    MultiRowRegionData,
    'featureStarts' | 'featurePartitionIndex' | 'featureColors'
  >,
  ctx: DrawnFeatureContext,
  rowCount: number,
): DrawnFeaturesByRow {
  // counting pass, then a prefix sum, then a placing pass — `forEachDrawnFeature`
  // both times, so which features are in here cannot diverge from which ones
  // paint
  const rowStart = new Int32Array(rowCount + 1)
  let drawn = 0
  forEachDrawnFeature(data, ctx, (_i, rowIndex) => {
    rowStart[rowIndex + 1]!++
    drawn++
  })
  for (let r = 0; r < rowCount; r++) {
    rowStart[r + 1]! += rowStart[r]!
  }
  const indices = new Int32Array(drawn)
  const cursor = Int32Array.from(rowStart.subarray(0, rowCount))
  forEachDrawnFeature(data, ctx, (i, rowIndex) => {
    indices[cursor[rowIndex]!++] = i
  })
  return { rowStart, indices }
}

/**
 * Index of the topmost drawn feature on `rowIndex` matching `match`, or -1.
 *
 * Back-to-front over that row, which is the whole reason this is not
 * `forEachDrawnFeature` with a break: both render paths paint in array order, so
 * a later feature sits *on top of* an overlapping earlier one, and a hit has to
 * resolve to the one the user can actually see. Searching forwards returns the
 * buried feature, and only on overlaps — which the data that motivates this
 * display (segments tiling a row) mostly does not have, so it would look right
 * until it didn't.
 *
 * Scoped to the row rather than scanning the region, because this runs on every
 * rAF-coalesced mouse move and the region is the whole painting: a walk over
 * half a million features, sixty times a second, to look at the couple of
 * hundred on the row under the cursor. The row is known before the scan starts,
 * so the bucketing above is what the scan should have been indexed by all along.
 */
export function findTopDrawnFeatureInRow(
  byRow: DrawnFeaturesByRow,
  rowIndex: number,
  match: (i: number) => boolean,
) {
  const { rowStart, indices } = byRow
  const lo = rowStart[rowIndex]
  const hi = rowStart[rowIndex + 1]
  if (lo === undefined || hi === undefined) {
    return -1
  }
  for (let k = hi - 1; k >= lo; k--) {
    const i = indices[k]!
    if (match(i)) {
      return i
    }
  }
  return -1
}
