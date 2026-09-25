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

/**
 * Whether a legend toggle hides a feature painted `abgr`. Only a row painting
 * the baked colour answers to the legend: a row with an override paints
 * something the legend never lists, so a baked colour equal to a hidden
 * category must not hide its features. The encode and every overlay read this
 * one rule.
 */
export function hiddenByCategory(
  abgr: number,
  rowOverridden: boolean,
  hiddenColors: ReadonlySet<number>,
) {
  return !rowOverridden && hiddenColors.has(abgr)
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
  return hiddenByCategory(
    data.featureColors[i]!,
    ctx.rowColorsByIndex[rowIndex] !== undefined,
    ctx.hiddenColors,
  )
    ? undefined
    : rowIndex
}

/**
 * The features that actually paint, in paint order, each with its display row
 * and ABGR color, for the overlays that walk the region data in drawn row
 * space. The encode walks it in key space through the same rule.
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
