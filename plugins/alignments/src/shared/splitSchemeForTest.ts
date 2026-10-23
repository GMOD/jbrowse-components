import { baseLayerOfField } from './alignmentsColor.ts'

import type { BaseLayer, ModificationColorBy } from './types.ts'

/**
 * A field as the two halves the display holds: a per-base field is the layer
 * over a plain fill, anything else the fill with no layer.
 */
export function splitSchemeForTest(
  field: string,
  modifications?: ModificationColorBy,
): { colorField: string; baseLayer: BaseLayer | undefined } {
  const type = baseLayerOfField(field)
  return type
    ? {
        colorField: '',
        baseLayer: modifications ? { type, modifications } : { type },
      }
    : { colorField: field, baseLayer: undefined }
}
