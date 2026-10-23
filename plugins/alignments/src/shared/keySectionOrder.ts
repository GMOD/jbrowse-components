import { sectionOrder } from './groupFeatures.ts'

import type { Facet } from './types.ts'

/**
 * The sections' order for the color key, where the facet reads the field the
 * reads are colored by: a key over one field lists it as the sections stack.
 * Not over `mapq`, whose sections are bins and whose key is its bins or its
 * raw values.
 */
export function keySectionOrder(facet: Facet | undefined, colorField: string) {
  return facet && facet.field === colorField && colorField !== 'mapq'
    ? sectionOrder(facet.field, facet.sort)
    : undefined
}
