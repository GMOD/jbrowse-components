import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { onDisplayedRegionsChange } from '@jbrowse/plugin-linear-genome-view'
import { observable } from 'mobx'

import { screenDensity } from '../LinearBasicDisplay/baseModelHelpers.ts'

import type { RegionDensityStats } from '../LinearBasicDisplay/baseModelHelpers.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  GateViewport,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// This ESM package builds without @types/node, but consuming bundlers still
// string-replace `process.env.NODE_ENV`, so keep the reference and give it a
// minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

/**
 * The members a composing display provides that this gate reads but doesn't own:
 * the config (via `getConf`) and the two `RegionTooLargeMixin` names the density
 * axis needs — "may anything gate?" and where to commit a measurement. Declared
 * once so the gate can reference them type-safely without threading them through
 * every getter — the runtime instance has them because the final model also
 * composes `MultiRegionDisplayMixin`, which brings `RegionTooLargeMixin`.
 */
interface GateHost {
  configuration: AnyConfigurationModel
  densityGateActive: boolean
  setByteEstimate: (measurement: {
    bytes: number | undefined
    viewport: GateViewport
  }) => void
  setGateMeasuredViewport: (viewport: GateViewport) => void
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
       * undefined (gate off) when nothing gates, otherwise the config. Force-load
       * and the `AUTO_FORCE_LOAD_BP` floor both reach this through the shared
       * `densityGateActive`, so approving a track's *size* no longer
       * half-disables its *density* axis by side effect, and the floor is
       * compared in one place rather than restated here.
       */
      get maxFeatureDensity(): number | undefined {
        return !self.densityGateEnabled || !host(self).densityGateActive
          ? undefined
          : getConf(host(self), 'maxFeatureScreenDensity')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The density axis of `RegionTooLargeMixin`'s verdict (false in the base
       * mixin, so byte-only displays never gate on it).
       */
      get densityTooLarge() {
        const max = self.maxFeatureDensity
        return max === undefined ? false : self.visibleFeatureDensityPerPx > max
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
       * publish the byte estimate to `RegionTooLargeMixin` — bytes and nothing
       * else, since the budget it is compared against is a main-thread config
       * read (`gateByteLimit`), the same one that produced the worker's
       * `resolvedByteLimit()`.
       */
      commitGateMeasurements(
        measurements: RegionGateMeasurement[],
        viewport: GateViewport,
      ) {
        // Nothing measured (every region's fetch went stale) — leave the
        // previous estimate alone rather than replacing it with an empty one,
        // and don't claim this viewport has been asked about either, or a
        // blocked display would stop re-measuring after a superseded fetch.
        if (measurements.length === 0) {
          return
        }
        // Stamped whatever the batch learned. A dense region short-circuits on
        // its feature count and reports no bytes, but it did ask the adapter
        // about this viewport, and that is what `gateMeasurementStale` answers —
        // keying the stamp on bytes instead makes a density-blocked display
        // refetch forever.
        host(self).setGateMeasuredViewport(viewport)
        const byteCounts: number[] = []
        for (const { displayedRegionIndex, region, result } of measurements) {
          const { bytes, featureCount } = result
          if (bytes !== undefined) {
            byteCounts.push(bytes)
          }
          if (featureCount !== undefined) {
            self.setDensityStats(displayedRegionIndex, {
              featureCount,
              regionWidthBp: region.end - region.start,
            })
          }
        }
        // No byte count in the batch — either the adapter has no index estimate,
        // or the worker was handed no budget to measure against because the byte
        // gate was inactive for this fetch (force-loaded). Either way this fetch
        // measured nothing, so leave the previous estimate and the span it was
        // taken at untouched rather than overwriting them with an unmeasurable
        // one: an empty write would also reset the zoom-effectiveness comparison
        // that `nextByteEstimate` builds across two real measurements. The
        // pre-flight path never had the problem — `byteGateBlocksFetch` skips the
        // RPC outright when nothing could gate, and so writes nothing.
        if (byteCounts.length > 0) {
          host(self).setByteEstimate({
            // Per-region max, not sum: each region is gated against the same
            // per-region budget.
            bytes: Math.max(...byteCounts),
            viewport,
          })
        }
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
        // Compose-order self-check. Both this mixin and `RegionTooLargeMixin`
        // (via MultiRegionDisplayMixin) declare `gateFoldedIntoFetch`, and
        // `types.compose` resolves the collision to the later argument — so
        // composing this one FIRST silently switches the entire size gate off
        // with no error anywhere. Reading our own opt-in back is the whole test:
        // if it isn't true, the base's `false` won.
        if (
          process.env.NODE_ENV !== 'production' &&
          !self.gateFoldedIntoFetch
        ) {
          console.error(
            '[jbrowse display contract] CanvasFeatureGateMixin() must be ' +
              'composed AFTER MultiRegionDisplayMixin(): the later .compose() ' +
              'argument wins on `gateFoldedIntoFetch`, and the region-too-large ' +
              'gate is currently disabled for this display. See ' +
              'agent-docs/reference/REGION_TOO_LARGE.md.',
          )
        }
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
