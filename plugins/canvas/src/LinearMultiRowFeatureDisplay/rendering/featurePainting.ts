import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './multiRowRenderingBackendTypes.ts'

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
export interface DrawnFeatureContext {
  rowForLocal: readonly (number | undefined)[]
  rowColorsByIndex: readonly (number | undefined)[]
  hiddenColors: ReadonlySet<number>
}

export function drawnFeatureContext(
  data: Pick<MultiRowRegionData, 'partitionValues'>,
  state: Pick<
    MultiRowRenderState,
    'rowIndexByValue' | 'rowColorsByIndex' | 'hiddenColors'
  >,
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
 * Index of the topmost drawn feature matching `match`, or -1.
 *
 * Back-to-front, which is the whole reason this is not `forEachDrawnFeature`
 * with a break: both render paths paint in array order, so a later feature sits
 * *on top of* an overlapping earlier one, and a hit has to resolve to the one
 * the user can actually see. Searching forwards returns the buried feature, and
 * only on overlaps — which the data that motivates this display (segments
 * tiling a row) mostly does not have, so it would look right until it didn't.
 */
export function findTopDrawnFeature(
  data: Pick<
    MultiRowRegionData,
    'featureStarts' | 'featurePartitionIndex' | 'featureColors'
  >,
  ctx: DrawnFeatureContext,
  match: (i: number, rowIndex: number) => boolean,
) {
  for (let i = data.featureStarts.length - 1; i >= 0; i--) {
    const rowIndex = drawnRowAt(data, ctx, i)
    if (rowIndex !== undefined && match(i, rowIndex)) {
      return i
    }
  }
  return -1
}
