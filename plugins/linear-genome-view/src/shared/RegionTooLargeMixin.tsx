import { types } from '@jbrowse/mobx-state-tree'

import TooLargeMessage from './TooLargeMessage.tsx'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Shared mixin owning "region too large" state and force-load UI.
 *
 * Composed by both FeatureDensityMixin (block-based server-side rendered
 * displays like LinearBasicDisplay, LinearArcDisplay)
 * and MultiRegionDisplayMixin (canvas/GPU displays like
 * LinearAlignmentsDisplay, LinearWiggleDisplay, LinearBasicDisplay).
 *
 * Owns the state that TooLargeMessage reads: regionTooLarge,
 * regionTooLargeReason, featureDensityStats, setFeatureDensityStatsLimit.
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
    .views(self => ({
      /**
       * #method
       */
      // Reads through the `regionTooLarge` getter (not `regionTooLargeState`
      // directly) so subclasses that override the getter with a derived
      // computation — e.g. canvas's density-based derivation — see the
      // banner reflect their state.
      regionCannotBeRendered(_region?: Region) {
        return self.regionTooLarge ? <TooLargeMessage model={self} /> : null
      },
    }))
}
