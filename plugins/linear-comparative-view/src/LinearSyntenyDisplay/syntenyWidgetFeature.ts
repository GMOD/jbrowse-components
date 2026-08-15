import type { FeatPos } from './model.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

/**
 * The serialized feature a clicked ribbon opens its detail panel with.
 *
 * The numeric channels go in FIRST so the located fields below always win. A
 * channel name is a column name out of the track's own `attributeColumns`, so a
 * table declaring `start` would otherwise move the feature the panel is
 * describing — the panel would name one locus and its "open in view" link
 * another. Its own function, rather than an object literal in the click
 * handler, so that precedence is a thing a test can hold.
 */
export function syntenyWidgetFeature(feat: FeatPos): SimpleFeatureSerialized {
  return {
    ...feat.attributes,
    uniqueId: feat.id,
    start: feat.start,
    end: feat.end,
    strand: feat.strand,
    refName: feat.refName,
    name: feat.name,
    assemblyName: feat.assemblyName,
    mate: feat.mate,
  }
}
