import type { FieldPalette } from '../../RenderFeatureDataRPC/colorClasses.ts'
import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

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
