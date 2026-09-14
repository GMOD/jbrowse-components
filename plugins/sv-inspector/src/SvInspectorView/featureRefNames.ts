import { SimpleFeature } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

/**
 * The refNames a feature's chord touches.
 *
 * Through the same `svMateLocus` the circular view's `getEndpoint` resolves the
 * far end with, so the set of chromosomes this reports and the set the chords
 * are drawn on cannot disagree. "Show only regions with data" narrows the
 * circle to this set.
 */
export function featureRefNames(data: SimpleFeatureSerialized) {
  const feature = new SimpleFeature(data)
  return [feature.get('refName'), svMateLocus(feature)?.refName]
}
