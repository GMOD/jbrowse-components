import { getConf } from '@jbrowse/core/configuration'
import { onDisplayedRegionsChange } from '@jbrowse/display-kit/displayAutoruns'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'

import { overDensityBudget } from '../RenderFeatureDataRPC/densityGate.ts'
import { screenDensity } from './regionDensity.ts'

import type { LinearCanvasBaseDisplayConfigModel } from '../LinearBasicDisplay/baseConfigSchema.ts'
import type { RegionDensityStats } from './regionDensity.ts'
import type { GateFetchState } from '@jbrowse/display-kit/regionTooLargeUtils'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface GateHost {
  configuration: Instance<LinearCanvasBaseDisplayConfigModel>
  densityGateActive: boolean
  byteGateAdapterKey: string
}

function host(self: object) {
  return self as GateHost
}

export interface RegionGateMeasurement {
  displayedRegionIndex: number
  region: { start: number; end: number }
  result: { bytes?: number; featureCount?: number }
}

/**
 * The density axis of the region-too-large gate, composed after
 * `MultiRegionDisplayMixin`. A display opts in by composing this and calling
 * `commitGateMeasurements` from its fetch's `onComplete`.
 *
 * #stateModel CanvasFeatureGateMixin
 * #category display
 */
export default function CanvasFeatureGateMixin() {
  return types
    .model('CanvasFeatureGateMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * Per-region feature counts, so the verdict is a live max at the current
       * `bpPerPx`.
       */
      densityStatsPerRegion: regionDataMap<RegionDensityStats>(
        'densityStatsPerRegion',
      ),
    }))
    .views(self => ({
      /**
       * #getter
       * `types.compose` resolves a collision to the later argument, so this
       * mixin must follow the one declaring the byte-gate opt-in.
       */
      get gateEnabled() {
        return true
      },
      /**
       * #method
       */
      observedMaxDensity(bpPerPx: number) {
        return Math.max(
          0,
          ...containingLgv(self).visibleRegions.map(r => {
            const ds = self.densityStatsPerRegion.get(r.displayedRegionIndex)
            return ds ? screenDensity(ds, bpPerPx) : 0
          }),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Density at the debounced `coarseBpPerPx`, so the verdict shares the
       * layout cadence.
       */
      get visibleFeatureDensityPerPx() {
        const view = containingLgv(self)
        if (!view.initialized) {
          return 0
        }
        return self.observedMaxDensity(view.coarseBpPerPx)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Undefined when the axis may not act.
       */
      get maxFeatureDensity(): number | undefined {
        return host(self).densityGateActive
          ? getConf(host(self), 'maxFeatureScreenDensity')
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get densityTooLarge() {
        return overDensityBudget(
          self.visibleFeatureDensityPerPx,
          self.maxFeatureDensity,
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setDensityStats(displayedRegionIndex: number, stats: RegionDensityStats) {
        self.densityStatsPerRegion.set(displayedRegionIndex, stats)
      },
      /**
       * #action
       */
      clearGateMeasurements() {
        self.densityStatsPerRegion.clear()
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Judged by the tier captured at issue.
       */
      commitGateMeasurements(
        measurements: RegionGateMeasurement[],
        issued: GateFetchState,
      ) {
        const { viewport, tierKey } = issued
        if (
          !viewport ||
          (tierKey !== undefined && tierKey !== host(self).byteGateAdapterKey)
        ) {
          return
        }
        for (const { displayedRegionIndex, region, result } of measurements) {
          const { featureCount } = result
          if (featureCount !== undefined) {
            self.setDensityStats(displayedRegionIndex, {
              featureCount,
              regionWidthBp: region.end - region.start,
            })
          }
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        onDisplayedRegionsChange(
          self,
          () => {
            self.clearGateMeasurements()
          },
          'CanvasFeatureGateClearOnNav',
        )
      },
    }))
}
