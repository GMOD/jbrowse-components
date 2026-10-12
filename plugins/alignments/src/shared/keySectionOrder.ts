import { colorFieldOf } from './alignmentsColor.ts'
import { sectionOrder } from './groupFeatures.ts'

import type { ColorBy, Facet } from './types.ts'

/**
 * The sections' order for the color key, where the facet reads the field the
 * reads are colored by: a key over one field lists it as the sections stack.
 * Not over `mapq`, whose sections are bins and whose key is its bins or its
 * raw values.
 */
export function keySectionOrder(facet: Facet | undefined, colorBy: ColorBy) {
  return facet &&
    facet.field === colorFieldOf(colorBy) &&
    colorBy.type !== 'mappingQuality'
    ? sectionOrder(facet.field, facet.domain)
    : undefined
}
