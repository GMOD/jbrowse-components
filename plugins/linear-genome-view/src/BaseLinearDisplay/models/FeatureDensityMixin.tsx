import React from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer, isAlive, types } from 'mobx-state-tree'

// locals
import autorunFeatureDensityStats from './autorunFeatureDensityStats'
import { getDisplayStr, getFeatureDensityStatsPre } from './util'
import TooLargeMessage from '../components/TooLargeMessage'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util/types'

type LGV = LinearGenomeViewModel

/**
 * #stateModel FeatureDensityMixin
 * #category display
 */
export default function FeatureDensityMixin() {
  return types
    .model({
      /**
       * #property
       */
      userBpPerPxLimit: types.maybe(types.number),
      /**
       * #property
       */

      userByteSizeLimit: types.maybe(types.number),
    })
    .volatile(() => ({
      featureDensityStatsP: undefined as
        | undefined
        | Promise<FeatureDensityStats>,
      featureDensityStats: undefined as undefined | FeatureDensityStats,
      currStatsBpPerPx: 0,
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
       */
      get featureDensityStatsReady() {
        const view = getContainingView(self) as LGV
        return (
          self.currStatsBpPerPx === view.bpPerPx &&
          (!!self.featureDensityStats || !!self.userBpPerPxLimit)
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
        addDisposer(
          self,
          autorun(() => autorunFeatureDensityStats(self as any)),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setCurrStatsBpPerPx(n: number) {
        self.currStatsBpPerPx = n
      },
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
            self as any,
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
       * region is too large if:
       * - stats are ready
       * - region is greater than 20kb (don't warn when zoomed in less than that)
       * - and bytes is greater than max allowed bytes or density greater than max
       *   density
       */
      get regionTooLarge() {
        const view = getContainingView(self) as LGV
        if (
          !self.featureDensityStatsReady ||
          view.dynamicBlocks.totalBp < 20_000
        ) {
          return false
        }
        return (
          self.currentBytesRequested > self.maxAllowableBytes ||
          (self.userBpPerPxLimit
            ? view.bpPerPx > self.userBpPerPxLimit
            : self.currentFeatureScreenDensity > self.maxFeatureScreenDensity)
        )
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
        return self.regionTooLarge ? (
          <TooLargeMessage model={self as any} />
        ) : null
      },
    }))
}
