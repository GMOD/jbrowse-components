import { baseLayerOfField } from './alignmentsColor.ts'
import { DEFAULT_BASES_FILTER } from './basesFilter.ts'

import type { BaseColorField, BaseLayer, BasesFilter } from './types.ts'

/** A per-base layer with its modification settings left to their defaults. */
export interface LayerSpec {
  field: BaseColorField
  unmodified?: boolean
  filter?: BasesFilter
}

export function layerForTest({
  field,
  unmodified = false,
  filter = DEFAULT_BASES_FILTER,
}: LayerSpec): BaseLayer {
  return field === 'modifications' || field === 'bisulfite'
    ? { field, unmodified, filter }
    : { field }
}

/**
 * A field as the two halves the display holds: a per-base field is the layer
 * over a plain fill, anything else the fill with no layer.
 */
export function splitFieldForTest(
  field: string | undefined,
  settings?: Omit<LayerSpec, 'field'>,
): { colorField: string | undefined; baseLayer: BaseLayer | undefined } {
  const layer = baseLayerOfField(field)
  return layer
    ? {
        colorField: undefined,
        baseLayer: layerForTest({ field: layer, ...settings }),
      }
    : { colorField: field, baseLayer: undefined }
}
