import { types } from '@jbrowse/mobx-state-tree'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Shared mixin owning "region too large" state and force-load UI.
 *
 * Composed by MultiRegionDisplayMixin (canvas/GPU displays like
 * LinearAlignmentsDisplay, LinearWiggleDisplay, LinearBasicDisplay) and
 * directly by the SVG arc displays (LinearArcDisplay, LinearPairedArcDisplay),
 * which do their own byte-estimate gating in fetchArcFeatures.
 *
 * Owns the state that TooLargeMessage reads: regionTooLarge,
 * regionTooLargeReason, forceLoad.
 *
 * #stateModel RegionTooLargeMixin
 * #category display
 */
export default function RegionTooLargeMixin() {
  return types
    .model('RegionTooLargeMixin', {
      /**
       * #property
       * user-confirmed byte limit after a force-load, disabling the gate
       */
      userByteSizeLimit: types.maybe(types.number),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      regionTooLargeState: false,
      /**
       * #volatile
       */
      regionTooLargeReasonState: '',
      /**
       * #volatile
       */
      featureDensityStats: undefined as FeatureDensityStats | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get regionTooLarge() {
        return self.regionTooLargeState
      },

      /**
       * #getter
       */
      get regionTooLargeReason() {
        return self.regionTooLargeReasonState
      },
    }))
    .views(self => ({
      /**
       * #method
       * Plaintext reason (for SVG export); the on-screen too-large UI is
       * rendered by the display chrome via `TooLargeMessage`, not the model.
       */
      regionCannotBeRenderedText(_region?: Region) {
        return self.regionTooLarge ? 'Force load to see features' : ''
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRegionTooLarge(val: boolean, reason?: string) {
        self.regionTooLargeState = val
        self.regionTooLargeReasonState = reason ?? ''
      },

      /**
       * #action
       */
      setFeatureDensityStats(stats?: FeatureDensityStats) {
        self.featureDensityStats = stats
      },

      /**
       * #action
       * force-load: raise the byte limit past the current request and clear
       * the too-large banner
       */
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        if (stats?.bytes) {
          self.userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
        }
        self.regionTooLargeState = false
        self.regionTooLargeReasonState = ''
      },

      /**
       * #action
       */
      reload() {
        // no-op, overridden by composing display models
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Raises the byte limit past the current density stats and triggers a
       * reload. The display chrome calls this via TooLargeMessage's force-load
       * button; concrete display models override reload() to do the actual
       * refetch.
       */
      forceLoad() {
        self.setFeatureDensityStatsLimit(self.featureDensityStats)
        self.reload()
      },
    }))
}
