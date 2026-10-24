import { baseLayerOfField } from './alignmentsColor.ts'

import type { BaseLayer } from './types.ts'

/**
 * A field as the two halves the display holds: a per-base field is the layer
 * over a plain fill, anything else the fill with no layer.
 */
export function splitFieldForTest(
  field: string | undefined,
  settings?: Omit<BaseLayer, 'field'>,
): { colorField: string | undefined; baseLayer: BaseLayer | undefined } {
  const layer = baseLayerOfField(field)
  return layer
    ? { colorField: undefined, baseLayer: { field: layer, ...settings } }
    : { colorField: field, baseLayer: undefined }
}
