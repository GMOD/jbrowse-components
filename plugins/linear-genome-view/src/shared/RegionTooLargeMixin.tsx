import { createElement } from 'react'

import { types } from '@jbrowse/mobx-state-tree'

import TooLargeMessage from './TooLargeMessage.tsx'

export interface FeatureDensityStats {
  bytes?: number
  fetchSizeLimit?: number
}

export default function RegionTooLargeMixin() {
  return types
    .model({
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
      regionCannotBeRendered() {
        return self.regionTooLargeState
          ? createElement(TooLargeMessage, { model: self as any })
          : null
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
    }))
}
