import { types } from '@jbrowse/mobx-state-tree'

import type { FlatbushEntry } from './flatbushType'
import type Flatbush from '@jbrowse/core/util/flatbush'

/**
 * Mixin for LinearRead displays that use Flatbush layout for mouseover functionality
 * Used by LinearReadCloudDisplay and LinearReadStackDisplay
 */
export function LinearReadDisplayWithLayoutMixin() {
  return types
    .model('LinearReadDisplayWithLayoutMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * Flatbush spatial index for efficient mouseover detection
       */
      featureLayout: undefined as Flatbush | undefined,
      /**
       * #volatile
       * Reference to the mouseover overlay canvas
       */
      mouseoverRef: null as HTMLCanvasElement | null,
      /**
       * #volatile
       * Array of feature data for Flatbush spatial index
       */
      featuresForFlatbush: [] as FlatbushEntry[],
    }))
    .actions(self => ({
      /**
       * #action
       * Set the Flatbush spatial index
       */
      setFeatureLayout(layout: Flatbush) {
        self.featureLayout = layout
      },
      /**
       * #action
       * Set reference to the mouseover canvas element
       */
      setMouseoverRef(ref: HTMLCanvasElement | null) {
        self.mouseoverRef = ref
      },
      /**
       * #action
       * Set the features data for Flatbush index
       */
      setFeaturesForFlatbush(features: FlatbushEntry[]) {
        self.featuresForFlatbush = features
      },
    }))
}
