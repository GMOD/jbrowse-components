import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'
import { observable } from 'mobx'

import { screenDensity } from '../LinearBasicDisplay/baseModelHelpers.ts'

import type { RegionDensityStats } from '../LinearBasicDisplay/baseModelHelpers.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RegionByteEstimate } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The members a composing display provides that this gate reads but doesn't own:
 * the config (via `getConf`) and the `RegionTooLargeMixin` surface (byte
 * estimate, the resolved budgets, commit). Declared once so the gate can
 * reference them type-safely without threading them through every getter — the
 * runtime instance has them because the final model also composes
 * `MultiRegionDisplayMixin`, which brings `RegionTooLargeMixin`.
 */
interface GateHost {
  configuration: AnyConfigurationModel
  byteGateExempt: boolean
  gateByteLimit: number
  setByteEstimate: (
    estimate: RegionByteEstimate,
    measuredSpanBp: number,
  ) => void
}

function host(self: object) {
  return self as GateHost
}

function gateView(self: object) {
  return getContainingView(self) as LinearGenomeViewModel
}

/**
 * What one region's fetch measured, feeding both gate axes: the byte index size
 * (`bytes`, absent when the adapter has no index estimate) and the feature count
 * (`featureCount`, absent on a byte short-circuit). `regionWidthBp` anchors the
 * density measurement to the region's span.
 */
export interface RegionGateMeasurement {
  displayedRegionIndex: number
  regionWidthBp: number
  bytes?: number
  featureCount?: number
}

/**
 * Shared byte + density region-too-large gate for canvas feature displays.
 *
 * Composes on top of `RegionTooLargeMixin` (via `MultiRegionDisplayMixin`) to add
 * the *density* axis and the worker-facing budgets, so a display that folds the
 * byte/density check into its own fetch RPC (canvas-style, no pre-flight) opts in
 * by composing this mixin and calling `commitGateMeasurements` from its fetch. The
 * mixin clears its own stale per-region stats on chromosome nav (its `afterAttach`,
 * so a composing display can't forget the cleanup and silently mis-gate a reused
 * `displayedRegionIndex`). Every gating decision routes through the shared pure
 * helpers in `regionTooLargeUtils` (`resolveByteLimit`, `resolveForceLoadLimits`,
 * `evaluateRegionTooLarge` via the base mixin) so both canvas feature displays
 * decide identically.
 *
 * This is the **model-side** counterpart to `DisplayChrome`: the gate's whole job
 * is to feed one signal — `regionTooLarge` (on `RegionTooLargeMixin`) — which
 * `DisplayChrome`'s `computeDisplayPhase` reads to render the shared
 * `TooLargeMessage` banner (see
 * [DISPLAYCHROME.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/DISPLAYCHROME.md)).
 * A
 * display opts into the whole banner story by composing this mixin (the decision)
 * and rendering `DisplayChrome` (the UI) — the same "single shared layer, small
 * opt-in contract" shape DisplayChrome uses for loading/error/retry.
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
       * per-region feature counts (keyed by displayedRegionIndex), so the density
       * verdict is a live max over the visible regions at the current bpPerPx —
       * never a stale fetch-time snapshot. Survives viewport-change clears; dropped
       * on chromosome nav by `clearGateMeasurements`.
       */
      densityStatsPerRegion: observable.map<number, RegionDensityStats>(),
    }))
    .views(self => ({
      /**
       * #getter
       * Contributes the opt-in additively rather than overriding
       * `derivedRegionTooLargeEnabled`: `MultiRegionDisplayMixin` ORs this in,
       * so the gate stays on whichever side of `.compose()` this mixin lands.
       */
      get gateFoldedIntoFetch() {
        return true
      },
      /**
       * #getter
       * Whether the density (features-per-pixel) axis applies. Byte-only displays
       * override this to `false`: e.g. `LinearMultiRowFeatureDisplay` paints
       * features into fixed lanes, so a high total feature count is not a
       * per-glyph render cost — only the download (byte) budget should gate it.
       */
      get densityGateEnabled() {
        return true
      },
      /**
       * #method
       * Highest features-per-pixel across the visible regions at `bpPerPx`, from
       * the cached per-region counts.
       */
      observedMaxDensity(bpPerPx: number) {
        return Math.max(
          0,
          ...gateView(self).visibleRegions.map(r => {
            const ds = self.densityStatsPerRegion.get(r.displayedRegionIndex)
            return ds ? screenDensity(ds, bpPerPx) : 0
          }),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Current density across the visible regions at the debounced coarseBpPerPx,
       * so the verdict shares the layout cadence and doesn't flicker mid-zoom.
       */
      get visibleFeatureDensityPerPx() {
        return self.observedMaxDensity(gateView(self).coarseBpPerPx)
      },
      /**
       * #getter
       * No axis gates at all: an exempt adapter / declarative force-load, or a
       * span under the AUTO_FORCE_LOAD_BP floor. Both worker budgets go
       * undefined here, so the fetch skips the estimate rather than paying for
       * one the verdict ignores.
       */
      get gateInactive() {
        return (
          host(self).byteGateExempt ||
          gateView(self).visibleBp < AUTO_FORCE_LOAD_BP
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The density budget passed to the worker and used by the derived verdict:
       * undefined (gate off) when nothing gates, otherwise the config. Force-load
       * reaches this through `gateInactive`, so approving a track's *size* no
       * longer half-disables its *density* axis by side effect — both axes are the
       * one boolean now.
       */
      get maxFeatureDensity(): number | undefined {
        return !self.densityGateEnabled || self.gateInactive
          ? undefined
          : getConf(host(self), 'maxFeatureScreenDensity')
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get densityTooLarge() {
        const max = self.maxFeatureDensity
        return max === undefined ? false : self.visibleFeatureDensityPerPx > max
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Folds the density axis into `RegionTooLargeMixin`'s byte-only verdict.
       */
      get densityTooLargeForDerivedGate() {
        return self.densityTooLarge
      },
      /**
       * #method
       * The byte budget the fetch RPC enforces, short-circuiting an over-budget
       * region before downloading features. Undefined (unlimited) when nothing
       * gates; otherwise the very number the banner compares against, so the
       * worker can't reject a region the banner then calls fine.
       */
      resolvedByteLimit(): number | undefined {
        return self.gateInactive ? undefined : host(self).gateByteLimit
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
       * Drop the cached per-region density stats on chromosome navigation
       * (displayedRegion indices get reused, so a stale entry would gate the new
       * region against the wrong stats). Driven by the mixin's own `afterAttach`
       * below — no composing display has to wire it up. The byte estimate is
       * dropped by `MultiRegionDisplayMixin`'s `DisplayedRegionsChange` autorun
       * on the same trigger.
       *
       * Measurements only. Force-load is a track-wide boolean that deliberately
       * outlives navigation, so there is no per-region ceiling to expire here.
       */
      clearGateMeasurements() {
        self.densityStatsPerRegion.clear()
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Commit a batch of per-region fetch outcomes: record the per-region byte
       * **max** (not sum — each region is gated against the same per-region
       * budget, so a multi-region view where every region individually fits is
       * never blanked by the cross-region total) and the per-region density, then
       * publish the byte estimate + adapter limit to `RegionTooLargeMixin` so the
       * banner's `resolveByteLimit` picks the same budget the worker gated on.
       */
      commitGateMeasurements(
        measurements: RegionGateMeasurement[],
        measuredSpanBp: number,
      ) {
        // Nothing measured (every region's fetch went stale) — leave the
        // previous estimate alone rather than replacing it with an empty one.
        if (measurements.length === 0) {
          return
        }
        const byteCounts: number[] = []
        for (const {
          displayedRegionIndex,
          regionWidthBp,
          bytes,
          featureCount,
        } of measurements) {
          if (bytes !== undefined) {
            byteCounts.push(bytes)
          }
          if (featureCount !== undefined) {
            self.setDensityStats(displayedRegionIndex, {
              featureCount,
              regionWidthBp,
            })
          }
        }
        host(self).setByteEstimate(
          {
            // An adapter with no index estimate reports none for any region, so
            // an empty list is "unmeasurable", not "zero bytes" — keep it
            // undefined so the byte axis stays out of the verdict entirely.
            bytes: byteCounts.length > 0 ? Math.max(...byteCounts) : undefined,
          },
          measuredSpanBp,
        )
      },
    }))
    .actions(self => ({
      // The fork auto-chains afterAttach, so this runs ahead of the composing
      // display's own afterAttach without either calling super. Owning the
      // chromosome-nav cleanup here — rather than leaving each display to wire
      // onDisplayedRegionsChange itself — makes composing the mixin the whole
      // opt-in: a new canvas feature display can't forget it and silently gate a
      // reused displayedRegionIndex against a prior chromosome's stats.
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
