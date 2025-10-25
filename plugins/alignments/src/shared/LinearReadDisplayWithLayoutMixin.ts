import { types } from 'mobx-state-tree'

import type Flatbush from '@jbrowse/core/util/flatbush'
import type { ReducedFeature } from './fetchChains'

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
      featuresForFlatbush: [] as {
        x1: number
        y1: number
        x2: number
        y2: number
        data: ReducedFeature
        chainId: string
        chainMinX: number
        chainMaxX: number
        chain: ReducedFeature[]
      }[],
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
      setFeaturesForFlatbush(
        features: {
          x1: number
          y1: number
          x2: number
          y2: number
          data: ReducedFeature
          chainId: string
          chainMinX: number
          chainMaxX: number
          chain: ReducedFeature[]
        }[],
      ) {
        self.featuresForFlatbush = features
      },
    }))
}
