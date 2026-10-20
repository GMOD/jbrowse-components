import { baseLayerOfField } from './alignmentsColor.ts'

import type { BaseLayer, ColorBy, ReadColorBy } from './types.ts'

/**
 * A scheme by name as the two halves the display holds: a per-base scheme is
 * the layer over a plain fill, anything else the fill with no layer.
 */
export function splitSchemeForTest(colorBy: ColorBy | undefined): {
  colorBy: ReadColorBy | undefined
  baseLayer: BaseLayer | undefined
} {
  return colorBy && baseLayerOfField(colorBy.type)
    ? { colorBy: { type: 'normal' }, baseLayer: colorBy as BaseLayer }
    : { colorBy: colorBy as ReadColorBy | undefined, baseLayer: undefined }
}
