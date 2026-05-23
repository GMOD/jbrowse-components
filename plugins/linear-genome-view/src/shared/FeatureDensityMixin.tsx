import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import RegionTooLargeMixin from './RegionTooLargeMixin.tsx'
import TooLargeMessage from './TooLargeMessage.tsx'
import autorunFeatureDensityStats from './autorunFeatureDensityStats.ts'
import {
  getDisplayStr,
  getFeatureDensityStatsPre,
} from './featureDensityUtils.ts'
import { AUTO_FORCE_LOAD_BP } from '../LinearGenomeView/index.ts'

import type { FeatureDensityModel } from './autorunFeatureDensityStats.ts'
import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util/types'

type LGV = LinearGenomeViewModel

type FeatureDensityStatsSelf = Parameters<typeof getFeatureDensityStatsPre>[0]

interface WithConfiguration {
  configuration: AnyConfigurationModel
}
/**
 * Block-based display mixin that adds reactive density-stats checking
 * on top of RegionTooLargeMixin.
 *
 * Runs autorunFeatureDensityStats to RPC for density stats, then computes
 * regionTooLarge reactively from bytes/density thresholds.
 *
 * For canvas/GPU displays, use MultiRegionDisplayMixin instead (which
 * also composes RegionTooLargeMixin but uses an imperative check path).
 */
export default function FeatureDensityMixin() {
  return types
    .compose(
      'FeatureDensityMixin',
      RegionTooLargeMixin(),
      types.model({
        userBpPerPxLimit: types.maybe(types.number),
      }),
    )
    .volatile(() => ({
      featureDensityStatsP: undefined as
        | undefined
        | Promise<FeatureDensityStats>,
      currStatsBpPerPx: 0,
    }))
    .views(self => ({
      get currentBytesRequested() {
        return self.featureDensityStats?.bytes ?? 0
      },

      get currentFeatureScreenDensity() {
        const view = getContainingView(self) as LGV
        return (self.featureDensityStats?.featureDensity ?? 0) * view.bpPerPx
      },

      get maxFeatureScreenDensity() {
        return getConf(
          self as unknown as WithConfiguration,
          'maxFeatureScreenDensity',
        )
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
          self.userByteSizeLimit ??
          self.featureDensityStats?.fetchSizeLimit ??
          (getConf(
            self as unknown as WithConfiguration,
            'fetchSizeLimit',
          ) as number)
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

      // Override RegionTooLargeMixin's setFeatureDensityStatsLimit to also
      // handle bpPerPx-based limits for density-based "too large" detection
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        const view = getContainingView(self) as LGV
        if (stats?.bytes) {
          self.userByteSizeLimit = stats.bytes
        } else {
          self.userBpPerPxLimit = view.bpPerPx
        }
        self.setRegionTooLarge(false)
      },

      getFeatureDensityStats() {
        self.featureDensityStatsP ??= getFeatureDensityStatsPre(
          self as unknown as FeatureDensityStatsSelf,
        ).catch((e: unknown) => {
          if (isAlive(self)) {
            this.setFeatureDensityStatsP(undefined)
          }
          throw e
        })
        return self.featureDensityStatsP
      },

      setFeatureDensityStatsP(arg: Promise<FeatureDensityStats> | undefined) {
        self.featureDensityStatsP = arg
      },

      clearFeatureDensityStats() {
        self.featureDensityStatsP = undefined
        self.setFeatureDensityStats(undefined)
      },
    }))
    .views(self => ({
      // Override RegionTooLargeMixin's imperative regionTooLarge with a
      // reactive computation from density stats
      get regionTooLarge() {
        const view = getContainingView(self) as LGV
        if (
          !self.featureDensityStatsReady ||
          view.visibleBp < AUTO_FORCE_LOAD_BP
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
        return self.regionTooLarge ? <TooLargeMessage model={self} /> : null
      },
    }))
}
