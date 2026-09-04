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

/** What this mixin reads off its host: the config and `RegionTooLargeMixin`'s gate terms. */
export interface GateHost {
  configuration: Instance<LinearCanvasBaseDisplayConfigModel>
  densityGateActive: boolean
  byteGateAdapterKey: string
}

function host(self: object) {
  return self as GateHost
}

/** One region's fetch result plus the region, so the gate does the span arithmetic. */
export interface RegionGateMeasurement {
  displayedRegionIndex: number
  region: { start: number; end: number }
  result: { bytes?: number; featureCount?: number }
}

/**
 * The density axis of the region-too-large gate, composed after
 * `MultiRegionDisplayMixin`: how the features-per-pixel number is measured and
 * the worker budget for it. The byte axis is entirely `RegionTooLargeMixin`'s. A
 * display opts in by composing this and calling `commitGateMeasurements` from
 * its fetch's `onComplete`.
 *
 * One display composes it — `LinearBasicDisplay`'s base model. The multi-row
 * display has no density axis to gate on (see
 * MultiRowGetFeaturesRPC/rpcTypes.ts), so `shared/` here means "the canvas
 * plugin's rather than one display's", not "two displays compose it".
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
       * Per-region feature counts, keyed by `displayedRegionIndex`, so the
       * verdict is a live max at the current `bpPerPx`. Cleared on navigation.
       */
      densityStatsPerRegion: regionDataMap<RegionDensityStats>(
        'densityStatsPerRegion',
      ),
    }))
    .views(self => ({
      /**
       * #getter
       * The byte-gate opt-in, contributed here. `types.compose` resolves a
       * collision to the later argument, so this mixin must follow the one that
       * declares it; `no-restricted-syntax` fails the other order.
       */
      get gateEnabled() {
        return true
      },
      /**
       * #method
       * Highest features-per-pixel across the visible regions at `bpPerPx`.
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
       * layout cadence. Zero before the view is measured.
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
       * The worker's density budget; undefined when the axis may not act.
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
       * The density axis of the verdict, through the same `overDensityBudget`
       * the worker's short-circuits use.
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
       * Commit a batch of per-region fetch results on the density axis, judged
       * by the tier captured at issue. The byte axis is `commitFetchBytes`.
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
