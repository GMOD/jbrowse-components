import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import createFeatureDensityStatsAutorun from './autorunFeatureDensityStats.ts'
import { getDisplayStr, getFeatureDensityStatsPre } from './util.ts'
import TooLargeMessage from '../components/TooLargeMessage.tsx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util/types'

type LGV = LinearGenomeViewModel

type FeatureDensityStatsSelf = Parameters<typeof getFeatureDensityStatsPre>[0]

/**
 * #stateModel FeatureDensityMixin
 * #category display
 *
 * Manages feature density statistics and "too large" region warnings.
 *
 * State machine:
 * 1. On zoom change, autorun fetches density stats from adapter
 * 2. Stats are compared against limits (byte size or feature density)
 * 3. If region too large, warning shown with "Force load" button
 * 4. User can click "Force load" to set override (userBpPerPxLimit or userByteSizeLimit)
 * 5. Override persists until user zooms out further (triggering new warning)
 *
 * Key insight: Stats are estimates. We don't require them to be perfectly
 * synchronized with current zoom level - having ANY stats or user override
 * is sufficient to proceed with data fetching.
 */
export default function FeatureDensityMixin() {
  return types
    .model({
      /**
       * #property
       * User override: maximum bpPerPx allowed (set by "Force load")
       */
      userBpPerPxLimit: types.maybe(types.number),
      /**
       * #property
       * User override: maximum byte size allowed (set by "Force load")
       */
      userByteSizeLimit: types.maybe(types.number),
    })
    .volatile(() => ({
      featureDensityStatsP: undefined as
        | undefined
        | Promise<FeatureDensityStats>,
      featureDensityStats: undefined as undefined | FeatureDensityStats,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get currentBytesRequested() {
        return self.featureDensityStats?.bytes || 0
      },

      /**
       * #getter
       */
      get currentFeatureScreenDensity() {
        const view = getContainingView(self) as LGV
        return (self.featureDensityStats?.featureDensity || 0) * view.bpPerPx
      },

      /**
       * #getter
       */
      get maxFeatureScreenDensity() {
        // @ts-expect-error
        return getConf(self, 'maxFeatureScreenDensity')
      },
      /**
       * #getter
       * Stats are "ready" if we have ANY information to make decisions:
       * - Auto-fetched stats from adapter, OR
       * - User has clicked "Force load" (user override set)
       *
       * We don't require stats to be synchronized with current zoom level.
       * Stats are estimates and having slightly stale stats is fine.
       */
      get featureDensityStatsReady() {
        return (
          !!self.featureDensityStats ||
          !!self.userBpPerPxLimit ||
          !!self.userByteSizeLimit
        )
      },

      /**
       * #getter
       */
      get maxAllowableBytes() {
        return (
          self.userByteSizeLimit ||
          self.featureDensityStats?.fetchSizeLimit ||
          // @ts-expect-error
          (getConf(self, 'fetchSizeLimit') as number)
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(self, autorun(createFeatureDensityStatsAutorun(self)))
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        const view = getContainingView(self) as LGV
        if (stats?.bytes) {
          self.userByteSizeLimit = stats.bytes
        } else {
          self.userBpPerPxLimit = view.bpPerPx
        }
      },
      /**
       * #action
       */
      getFeatureDensityStats() {
        if (!self.featureDensityStatsP) {
          self.featureDensityStatsP = getFeatureDensityStatsPre(
            self as unknown as FeatureDensityStatsSelf,
          ).catch((e: unknown) => {
            if (isAlive(self)) {
              this.setFeatureDensityStatsP(undefined)
            }
            throw e
          })
        }
        return self.featureDensityStatsP
      },

      /**
       * #action
       */
      setFeatureDensityStatsP(arg: any) {
        self.featureDensityStatsP = arg
      },

      /**
       * #action
       */
      setFeatureDensityStats(featureDensityStats?: FeatureDensityStats) {
        self.featureDensityStats = featureDensityStats
      },
      /**
       * #action
       */
      clearFeatureDensityStats() {
        self.featureDensityStatsP = undefined
        self.featureDensityStats = undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Determines if the region is too large to safely render.
       *
       * Returns false if:
       * - Stats not ready yet
       * - Region is small (<20kb) - no need to warn when zoomed in
       *
       * Returns true if:
       * - Byte limit exceeded (checked first, most definitive), OR
       * - User has force-loaded before and current zoom exceeds that limit, OR
       * - Feature density exceeds threshold (fallback if no byte limit)
       */
      get regionTooLarge() {
        const view = getContainingView(self) as LGV
        if (
          !self.featureDensityStatsReady ||
          view.dynamicBlocks.totalBp < 20_000
        ) {
          return false
        }

        if (self.currentBytesRequested > self.maxAllowableBytes) {
          return true
        }

        if (self.userBpPerPxLimit) {
          return view.bpPerPx > self.userBpPerPxLimit
        }

        return self.currentFeatureScreenDensity > self.maxFeatureScreenDensity
      },

      /**
       * #getter
       * only shows a message of bytes requested is defined, the feature density
       * based stats don't produce any helpful message besides to zoom in
       */
      get regionTooLargeReason() {
        const req = self.currentBytesRequested
        const max = self.maxAllowableBytes

        return req && req > max
          ? `Requested too much data (${getDisplayStr(req)})`
          : ''
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get featureDensityStatsReadyAndRegionNotTooLarge() {
        return self.featureDensityStatsReady && !self.regionTooLarge
      },
      /**
       * #method
       */
      regionCannotBeRenderedText(_region: Region) {
        return self.regionTooLarge ? 'Force load to see features' : ''
      },

      /**
       * #method
       * @param region -
       * @returns falsy if the region is fine to try rendering. Otherwise,
       *  return a react node + string of text.
       *  string of text describes why it cannot be rendered
       *  react node allows user to force load at current setting
       */
      regionCannotBeRendered(_region: Region) {
        // @ts-expect-error
        return self.regionTooLarge ? <TooLargeMessage model={self} /> : null
      },
    }))
}
