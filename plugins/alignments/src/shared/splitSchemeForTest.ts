import { baseLayerOfField } from './alignmentsColor.ts'

import type { BaseLayer } from './types.ts'

/**
 * A field as the two halves the display holds: a per-base field is the layer
 * over a plain fill, anything else the fill with no layer.
 */
export function splitSchemeForTest(
  field: string,
  settings?: Omit<BaseLayer, 'field'>,
): { colorField: string; baseLayer: BaseLayer | undefined } {
  const layer = baseLayerOfField(field)
  return layer
    ? { colorField: '', baseLayer: { field: layer, ...settings } }
    : { colorField: field, baseLayer: undefined }
}
