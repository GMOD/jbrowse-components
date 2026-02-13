import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import autorunFeatureDensityStats from './autorunFeatureDensityStats.ts'
import { getDisplayStr, getFeatureDensityStatsPre } from './featureDensityUtils.ts'
import TooLargeMessage from './TooLargeMessage.tsx'

import type { FeatureDensityModel } from './autorunFeatureDensityStats.ts'
import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util/types'

type LGV = LinearGenomeViewModel

type FeatureDensityStatsSelf = Parameters<typeof getFeatureDensityStatsPre>[0]

export default function FeatureDensityMixin() {
  return types
    .model({
      userBpPerPxLimit: types.maybe(types.number),
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
      get currentBytesRequested() {
        return self.featureDensityStats?.bytes || 0
      },

      get currentFeatureScreenDensity() {
        const view = getContainingView(self) as LGV
        return (self.featureDensityStats?.featureDensity || 0) * view.bpPerPx
      },

      get maxFeatureScreenDensity() {
        // @ts-expect-error
        return getConf(self, 'maxFeatureScreenDensity')
      },

      get featureDensityStatsReady() {
        const view = getContainingView(self) as LGV
        return (
          self.currStatsBpPerPx === view.bpPerPx &&
          (!!self.featureDensityStats || !!self.userBpPerPxLimit)
        )
      },

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
          autorun(() =>
            autorunFeatureDensityStats(self as unknown as FeatureDensityModel),
          ),
        )
      },
    }))
    .actions(self => ({
      setCurrStatsBpPerPx(n: number) {
        self.currStatsBpPerPx = n
      },

      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        const view = getContainingView(self) as LGV
        if (stats?.bytes) {
          self.userByteSizeLimit = stats.bytes
        } else {
          self.userBpPerPxLimit = view.bpPerPx
        }
      },

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

      setFeatureDensityStatsP(arg: Promise<FeatureDensityStats> | undefined) {
        self.featureDensityStatsP = arg
      },

      setFeatureDensityStats(featureDensityStats?: FeatureDensityStats) {
        self.featureDensityStats = featureDensityStats
      },

      clearFeatureDensityStats() {
        self.featureDensityStatsP = undefined
        self.featureDensityStats = undefined
      },
    }))
    .views(self => ({
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

      get regionTooLargeReason() {
        const req = self.currentBytesRequested
        const max = self.maxAllowableBytes

        return req && req > max
          ? `Requested too much data (${getDisplayStr(req)})`
          : ''
      },
    }))
    .views(self => ({
      get featureDensityStatsReadyAndRegionNotTooLarge() {
        return self.featureDensityStatsReady && !self.regionTooLarge
      },

      regionCannotBeRenderedText(_region: Region) {
        return self.regionTooLarge ? 'Force load to see features' : ''
      },

      regionCannotBeRendered(_region: Region) {
        // @ts-expect-error
        return self.regionTooLarge ? <TooLargeMessage model={self} /> : null
      },
    }))
}
