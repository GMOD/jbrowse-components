import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './multiRowRenderingBackendTypes.ts'

// `featureDeltas` is EMPTY, not zero-filled, when the `lengthField` slot is
// unset, so "has deltas" is a length agreement with `featureStarts` — and every
// per-feature `featureDeltas[i]!` read is sound only once it holds.
export function regionWithDeltas(data: MultiRowRegionData | undefined) {
  return data && data.featureDeltas.length === data.featureStarts.length
    ? data
    : undefined
}

// Region-local partition value to global display-row index (undefined = a row
// not currently shown), so the per-feature lookup in the hot loop is an array
// index rather than a string-keyed Map.get.
export function resolveLocalRowIndices(
  partitionValues: string[],
  rowIndexByValue: ReadonlyMap<string, number>,
): (number | undefined)[] {
  return partitionValues.map(v => rowIndexByValue.get(v))
}

/**
 * Resolved once per region so the per-feature answer is array reads.
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

function drawnRowAt(
  data: Pick<MultiRowRegionData, 'featurePartitionIndex' | 'featureColors'>,
  ctx: DrawnFeatureContext,
  i: number,
) {
  const rowIndex = ctx.rowForLocal[data.featurePartitionIndex[i]!]
  if (rowIndex === undefined) {
    return undefined
  }
  // The hidden-category test applies only to rows painting the baked color: a
  // row with an override paints something the legend never lists, so a baked
  // color equal to a hidden category must not hide it.
  return ctx.rowColorsByIndex[rowIndex] === undefined &&
    ctx.hiddenColors.has(data.featureColors[i]!)
    ? undefined
    : rowIndex
}

/**
 * The features that actually paint, in paint order, each with its display row
 * and ABGR color. Every painter goes through this, because a painter that
 * re-derives the skip rules fails silently — it paints a category the legend
 * says is off, or an out-of-range lane.
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
