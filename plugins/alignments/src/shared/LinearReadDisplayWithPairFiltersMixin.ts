import { types } from 'mobx-state-tree'

/**
 * Mixin for LinearRead displays that support pair filtering and feature height customization
 * Used by LinearReadCloudDisplay and LinearReadStackDisplay
 */
export function LinearReadDisplayWithPairFiltersMixin() {
  return types
    .model('LinearReadDisplayWithPairFiltersMixin', {
      /**
       * #property
       * Whether to draw singleton reads (reads without a mate)
       */
      drawSingletons: true,

      /**
       * #property
       * Whether to draw proper pairs (correctly oriented and spaced paired reads)
       */
      drawProperPairs: true,

      /**
       * #property
       * Custom feature height override (if set, overrides configuration)
       */
      featureHeight: types.maybe(types.number),
    })
    .actions(self => ({
      /**
       * #action
       * Toggle whether to draw singleton reads
       */
      setDrawSingletons(f: boolean) {
        self.drawSingletons = f
      },
      /**
       * #action
       * Toggle whether to draw proper pairs
       */
      setDrawProperPairs(f: boolean) {
        self.drawProperPairs = f
      },
      /**
       * #action
       * Set custom feature height
       */
      setFeatureHeight(n?: number) {
        self.featureHeight = n
      },
    }))
}
