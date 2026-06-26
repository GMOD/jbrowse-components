import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import RegionTooLargeMixin from './RegionTooLargeMixin.tsx'
import TooLargeMessage from './TooLargeMessage.tsx'
import autorunFeatureDensityStats from './autorunFeatureDensityStats.ts'
import {
  evaluateRegionTooLarge,
  getFeatureDensityStatsPre,
  resolveByteLimit,
} from './featureDensityUtils.ts'

import type { FeatureDensityModel } from './autorunFeatureDensityStats.ts'
import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util/types'

type LGV = LinearGenomeViewModel

type FeatureDensityStatsSelf = Parameters<typeof getFeatureDensityStatsPre>[0]

/**
 * #stateModel FeatureDensityMixin
 * Block-based display mixin that adds reactive density-stats checking
 * on top of RegionTooLargeMixin.
 *
 * Runs autorunFeatureDensityStats to RPC for density stats, then computes
 * regionTooLarge reactively from bytes/density thresholds.
 *
 * For canvas/GPU displays, use MultiRegionDisplayMixin instead (which
 * also composes RegionTooLargeMixin but uses an imperative check path).
 */
export default function FeatureDensityMixin<
  TConf extends { configuration: AnyConfigurationModel } = {
    configuration: AnyConfigurationModel
  },
>() {
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
      get currentFeatureScreenDensity() {
        const view = getContainingView(self) as LGV
        return (self.featureDensityStats?.featureDensity ?? 0) * view.bpPerPx
      },

      get maxFeatureScreenDensity() {
        return getConf(self as unknown as TConf, 'maxFeatureScreenDensity')
      },

      get featureDensityStatsReady() {
        const view = getContainingView(self) as LGV
        return (
          self.currStatsBpPerPx === view.bpPerPx &&
          (!!self.featureDensityStats || !!self.userBpPerPxLimit)
        )
      },

      get maxAllowableBytes() {
        return resolveByteLimit({
          userByteSizeLimit: self.userByteSizeLimit,
          adapterFetchSizeLimit: self.featureDensityStats?.fetchSizeLimit,
          configFetchSizeLimit: getConf(
            self as unknown as TConf,
            'fetchSizeLimit',
          ) as number,
        })
      },
    }))
    .views(self => ({
      // a force-load sets userBpPerPxLimit, switching density gating from the
      // automatic screen-density check to a "this zoom or finer is allowed"
      get densityTooLarge() {
        const view = getContainingView(self) as LGV
        return self.userBpPerPxLimit
          ? view.bpPerPx > self.userBpPerPxLimit
          : self.currentFeatureScreenDensity > self.maxFeatureScreenDensity
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

      // regionTooLarge gates on bytes-over-limit OR density, so force-load must
      // relax both: always set userBpPerPxLimit, and raise the byte limit with
      // headroom when bytes are present (else clear it so it can't re-gate)
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        const view = getContainingView(self) as LGV
        self.userByteSizeLimit = stats?.bytes
          ? Math.ceil(stats.bytes * 1.5)
          : undefined
        self.userBpPerPxLimit = view.bpPerPx
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
      // Shared verdict + reason: bytes-over-limit takes precedence over density,
      // gated by AUTO_FORCE_LOAD_BP. Shares the reason text and threshold with
      // the canvas and pre-fetch byte paths so the banner can't drift.
      get tooLargeStatus() {
        const view = getContainingView(self) as LGV
        return evaluateRegionTooLarge({
          visibleBp: view.visibleBp,
          bytes: self.featureDensityStats?.bytes,
          byteLimit: self.maxAllowableBytes,
          densityTooLarge: self.densityTooLarge,
        })
      },
    }))
    .views(self => ({
      // reactive replacement for RegionTooLargeMixin's imperative version
      get regionTooLarge() {
        return self.featureDensityStatsReady && self.tooLargeStatus.tooLarge
      },

      get regionTooLargeReason() {
        return self.tooLargeStatus.reason
      },
    }))
    .views(self => ({
      get featureDensityStatsReadyAndRegionNotTooLarge() {
        return self.featureDensityStatsReady && !self.regionTooLarge
      },

      // regionCannotBeRenderedText is inherited from RegionTooLargeMixin; it
      // reads the overridden self.regionTooLarge so no redefinition is needed

      regionCannotBeRendered(_region: Region) {
        return self.regionTooLarge ? <TooLargeMessage model={self} /> : null
      },
    }))
}
