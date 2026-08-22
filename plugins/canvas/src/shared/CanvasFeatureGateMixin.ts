import { getConf } from '@jbrowse/core/configuration'
import { largestRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { onDisplayedRegionsChange } from '@jbrowse/plugin-linear-genome-view'
import { regionDataMap } from '@jbrowse/render-core/installPerRegionLifecycle'

import { overDensityBudget } from '../RenderFeatureDataRPC/densityGate.ts'
import { screenDensity } from './regionDensity.ts'

import type { RegionDensityStats } from './regionDensity.ts'
import type {
  BaseLinearDisplayConfigModel,
  GateFetchState,
  GateViewport,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * The members a composing display provides that this gate reads but doesn't own:
 * the config (via `getConf`) and the two `RegionTooLargeMixin` names the density
 * axis needs — "may anything gate?" and where to commit a measurement. Declared
 * once so the gate can reference them type-safely without threading them through
 * every getter — the runtime instance has them because the final model also
 * composes `MultiRegionDisplayMixin`, which brings `RegionTooLargeMixin`.
 */
export interface GateHost {
  // Narrow, not `AnyConfigurationModel`, so `maxFeatureScreenDensity` below
  // keeps its slot-name check — the widened form switches it off silently
  configuration: BaseLinearDisplayConfigModel
  gateActive: boolean
  densityGateActive: boolean
  commitByteMeasurement: (measurement: {
    viewport: GateViewport
    gated: boolean
    bytes?: number
  }) => void
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
 * (`featureCount`, absent on a byte short-circuit). Shaped as the fetch result
 * plus the region it came from — so a call site hands over what its RPC returned
 * and the span arithmetic (features per bp) stays in the gate, not repeated in
 * every display's fetch.
 */
export interface RegionGateMeasurement {
  displayedRegionIndex: number
  region: { start: number; end: number }
  result: { bytes?: number; featureCount?: number }
}

/**
 * Shared byte + density region-too-large gate for canvas feature displays.
 *
 * Composes on top of `RegionTooLargeMixin` (via `MultiRegionDisplayMixin`) to add
 * the *density* axis — the byte axis and its worker budget
 * (`resolvedByteLimit()`) are entirely the base mixin's — so a display that folds
 * the byte/density check into its own fetch RPC (canvas-style, no pre-flight)
 * opts in by composing this mixin and calling `commitGateMeasurements` from its
 * fetch. The
 * mixin clears its own stale per-region stats on chromosome nav (its `afterAttach`,
 * so a composing display can't forget the cleanup and silently mis-gate a reused
 * `displayedRegionIndex`). Every gating decision routes through the shared pure
 * helpers in `regionTooLargeUtils` (`resolveByteLimit`, `evaluateRegionTooLarge`, both via the
 * base mixin) so both canvas feature displays decide identically.
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
      densityStatsPerRegion: regionDataMap<RegionDensityStats>(
        'densityStatsPerRegion',
      ),
    }))
    .views(self => ({
      /**
       * #getter
       * Contributes the opt-in additively rather than overriding `gateEnabled`:
       * `RegionTooLargeMixin` ORs this with `measuresBytesPreFlight`, so the
       * gate stays on whichever side of `.compose()` this mixin lands.
       */
      get measuresBytesInFetch() {
        return true
      },
      /**
       * #getter
       * The density axis is on where something measures it, and this mixin is
       * the only thing that does — `densityTooLarge` below is the measurement,
       * this is the switch, and they belong together. `RegionTooLargeMixin`
       * defaults it false so the byte-only displays don't claim an axis they
       * have no number for.
       *
       * Contributed the same way as `measuresBytesInFetch` above, and it fails
       * the same way in the wrong compose order — the base's `false` wins and
       * the density axis is silently off. `no-restricted-syntax` fails a
       * `CanvasFeatureGateMixin()` written before `MultiRegionDisplayMixin()` in
       * one `types.compose` and says why, so neither opt-in needs a getter read
       * back at attach to notice.
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
        const view = gateView(self)
        // Nothing is on screen before the view has a width, so there is no
        // density to observe — and asking anyway throws rather than returning
        // an empty list, because `visibleRegions` walks the dynamic blocks and
        // those read `width`. Reached during `afterAttach` (TrackHeightMixin's
        // scroll clamp runs its autorun body straight away), which is before
        // the view is measured.
        if (!view.initialized) {
          return 0
        }
        return self.observedMaxDensity(view.coarseBpPerPx)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The density budget passed to the worker and used by the derived verdict:
       * undefined (gate off) when the axis can't gate, otherwise the config.
       * Every term for that — the opt-in, force-load, the `AUTO_FORCE_LOAD_BP`
       * floor — is inside `densityGateActive`, so approving a track's *size* no
       * longer half-disables its *density* axis by side effect and none of them
       * is restated here. It used to ask twice, `!densityGateEnabled ||
       * !densityGateActive`, because the first hook lived on this mixin where
       * the second one couldn't see it; both are `RegionTooLargeMixin`'s now.
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
       * The density axis of `RegionTooLargeMixin`'s verdict (false in the base
       * mixin, so byte-only displays never gate on it).
       *
       * The comparison is `overDensityBudget`, the same one the worker's two
       * short-circuits make — the number was already shared (`featuresPerPx`)
       * and the comparison was not, which left the banner free to disagree with
       * the decision that produced it at exactly the boundary.
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
       * Commit a batch of per-region fetch outcomes. Byte **max**, not sum: the
       * budget is per-region. See agent-docs/reference/REGION_TOO_LARGE.md.
       */
      commitGateMeasurements(
        measurements: RegionGateMeasurement[],
        issued: GateFetchState,
      ) {
        const { viewport, gated } = issued
        if (measurements.length === 0 || !viewport) {
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
        // the stamp-only-if-gated and skip-undefined-bytes rules live in the
        // shared commit, beside the pre-flight's copy of the same protocol
        host(self).commitByteMeasurement({
          viewport,
          gated,
          bytes: largestRegionBytes(measurements.map(m => m.result.bytes)),
        })
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
