import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearReadArcsDisplaySettingsMixin
 *
 * Mixin for LinearReadArcsDisplay-specific settings
 * Contains arc rendering options like line width, jitter, and connection toggles
 */
export function LinearReadArcsDisplaySettingsMixin() {
  return types
    .model('LinearReadArcsDisplaySettingsMixin', {
      /**
       * #property
       * Width of the arc lines (thin, bold, extra bold)
       */
      lineWidth: types.maybe(types.number),

      /**
       * #property
       * Jitter amount for x-position to better visualize overlapping arcs
       */
      jitter: types.maybe(types.number),

      /**
       * #property
       * Whether to draw inter-region vertical lines
       */
      drawInter: true,

      /**
       * #property
       * Whether to draw long-range connections
       */
      drawLongRange: true,
    })
    .actions(self => ({
      /**
       * #action
       * Toggle drawing of inter-region vertical lines
       */
      setDrawInter(f: boolean) {
        self.drawInter = f
      },

      /**
       * #action
       * Toggle drawing of long-range connections
       */
      setDrawLongRange(f: boolean) {
        self.drawLongRange = f
      },

      /**
       * #action
       * Set the line width (thin=1, bold=2, extrabold=5, etc)
       */
      setLineWidth(n: number) {
        self.lineWidth = n
      },

      /**
       * #action
       * Set jitter amount for x-position
       * Helpful to jitter the x direction so you see better evidence
       * when e.g. 100 long reads map to same x position
       */
      setJitter(n: number) {
        self.jitter = n
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get lineWidthSetting() {
        // @ts-expect-error getConf works
        return self.lineWidth ?? getConf(self, 'lineWidth')
      },

      /**
       * #getter
       */
      get jitterVal(): number {
        // @ts-expect-error getConf works
        return self.jitter ?? getConf(self, 'jitter')
      },
    }))
}
