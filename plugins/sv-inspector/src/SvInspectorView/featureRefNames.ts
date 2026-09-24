import { SimpleFeature } from '@jbrowse/core/util'
import { svMateLocus } from '@jbrowse/sv-core'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// svMateLocus is what the circular view draws the far end with
export function featureRefNames(data: SimpleFeatureSerialized) {
  const feature = new SimpleFeature(data)
  return [feature.get('refName'), svMateLocus(feature)?.refName]
}
