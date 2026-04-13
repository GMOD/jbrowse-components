import { types } from '@jbrowse/mobx-state-tree'

import TooLargeMessage from './TooLargeMessage.tsx'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'

/**
 * Shared mixin owning "region too large" state and force-load UI.
 *
 * Composed by both FeatureDensityMixin (block-based server-side rendered
 * displays like LinearBasicDisplay, LinearArcDisplay, LinearLollipopDisplay)
 * and MultiRegionDisplayMixin (canvas/GPU displays like
 * LinearAlignmentsDisplay, LinearWiggleDisplay, LinearBasicDisplay).
 *
 * Owns the state that TooLargeMessage reads: regionTooLarge,
 * regionTooLargeReason, featureDensityStats, setFeatureDensityStatsLimit.
 */
export default function RegionTooLargeMixin() {
  return types
    .model('RegionTooLargeMixin', {
      userByteSizeLimit: types.maybe(types.number),
    })
    .volatile(() => ({
      regionTooLargeState: false,
      regionTooLargeReasonState: '',
      featureDensityStats: undefined as FeatureDensityStats | undefined,
    }))
    .views(self => ({
      get regionTooLarge() {
        return self.regionTooLargeState
      },

      get regionTooLargeReason() {
        return self.regionTooLargeReasonState
      },

      regionCannotBeRenderedText() {
        return self.regionTooLargeState ? 'Force load to see features' : ''
      },
    }))
    .actions(self => ({
      setRegionTooLarge(val: boolean, reason?: string) {
        self.regionTooLargeState = val
        self.regionTooLargeReasonState = reason ?? ''
      },

      setFeatureDensityStats(stats?: FeatureDensityStats) {
        self.featureDensityStats = stats
      },

      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        if (stats?.bytes) {
          self.userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
        }
        self.regionTooLargeState = false
        self.regionTooLargeReasonState = ''
      },

      reload() {
        // no-op, overridden by composing display models
      },
    }))
    .views(self => ({
      regionCannotBeRendered() {
        return self.regionTooLargeState ? (
          <TooLargeMessage model={self} />
        ) : null
      },
    }))
}
