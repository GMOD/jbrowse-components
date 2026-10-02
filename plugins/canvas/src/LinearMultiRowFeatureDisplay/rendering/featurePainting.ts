import type { FieldPalette } from '../../RenderFeatureDataRPC/colorClasses.ts'
import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

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
  rowValues: string[],
  rowIndexByValue: ReadonlyMap<string, number>,
): (number | undefined)[] {
  return rowValues.map(v => rowIndexByValue.get(v))
}

type OwnColorData = Pick<
  MultiRowRegionData,
  'featureColors' | 'rectColorValues' | 'colorValues'
>

/**
 * Each feature's own color, resolved once per region: its value of the color
 * field through the field's palette while that field paints this region's
 * values, else what the worker baked. The encode, the overlays and the
 * hidden-category rule all read it, so a legend toggle hides what the paint
 * drew.
 */
export function ownColors(data: OwnColorData, fieldPalette?: FieldPalette) {
  const { featureColors, rectColorValues, colorValues } = data
  if (
    !fieldPalette ||
    !rectColorValues.length ||
    colorValues?.field !== fieldPalette.field
  ) {
    return featureColors
  }
  const table = fieldPalette.tableOf(colorValues.values, false)
  return Uint32Array.from(featureColors, (baked, i) => {
    const value = rectColorValues[i]!
    return value > 0 ? table[(value - 1) * 3]! : baked
  })
}

/**
 * Whether a legend toggle hides a feature painted `abgr`. Only a row painting
 * the feature's own colour answers to the legend: a row with an override
 * paints something the legend never lists, so an own colour equal to a hidden
 * category must not hide its features. The encode applies it, and every
 * overlay reads the encode.
 */
export function hiddenByCategory(
  abgr: number,
  rowOverridden: boolean,
  hiddenColors: ReadonlySet<number>,
) {
  return !rowOverridden && hiddenColors.has(abgr)
}
