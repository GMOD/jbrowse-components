import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  onDisplayedRegionsChange,
  resolveByteLimit,
  resolveForceLoadLimits,
} from '@jbrowse/plugin-linear-genome-view'
import { observable } from 'mobx'

import { screenDensity } from '../LinearBasicDisplay/baseModelHelpers.ts'

import type { RegionDensityStats } from '../LinearBasicDisplay/baseModelHelpers.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The members a composing display provides that this gate reads but doesn't own:
 * the config (via `getConf`), the adapter config, and the `RegionTooLargeMixin`
 * surface (byte estimate, the config-slot budgets, commit). Declared once so the
 * gate can reference them type-safely without threading them through every getter
 * — the runtime instance has them because the final model also composes
 * `MultiRegionDisplayMixin` (which brings `RegionTooLargeMixin`) and `BaseDisplay`
 * (which brings `adapterConfig`).
 */
interface GateHost {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  userByteSizeLimit?: number
  estimatedVisibleBytes?: number
  configuredFetchSizeLimit: number
  configForceLoad: boolean
  setFeatureDensityStats: (stats?: FeatureDensityStats) => void
}

function host(self: object) {
  return self as GateHost
}

function gateView(self: object) {
  return getContainingView(self) as LinearGenomeViewModel
}

/**
 * One per-region fetch outcome the gate needs to update its estimates: the byte
 * index size (`bytes`, absent when the adapter has no index estimate) and the
 * feature count (`featureCount`, absent on a byte short-circuit). `regionWidthBp`
 * anchors the density measurement to the region's span.
 */
export interface FeatureGateRegionResult {
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
 * by composing this mixin and calling `commitFeatureGateStats` from its fetch. The
 * mixin clears its own stale per-region stats on chromosome nav (its `afterAttach`,
 * so a composing display can't forget the cleanup and silently mis-gate a reused
 * `displayedRegionIndex`). Every gating decision routes through the shared pure
 * helpers in `featureDensityUtils` (`resolveByteLimit`, `resolveForceLoadLimits`,
 * `evaluateRegionTooLarge` via the base mixin) so both canvas feature displays
 * decide identically.
 *
 * This is the **model-side** counterpart to `DisplayChrome`: the gate's whole job
 * is to feed one signal — `regionTooLarge` (on `RegionTooLargeMixin`) — which
 * `DisplayChrome`'s `computeDisplayPhase` reads to render the shared
 * `TooLargeMessage` banner (see `agent-docs/reference/DISPLAYCHROME.md`). A
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
       * on chromosome nav by `clearFeatureGateStats`.
       */
      densityStatsPerRegion: observable.map<number, RegionDensityStats>(),
      /**
       * #volatile
       * density force-load ceiling; the density-axis counterpart to
       * `RegionTooLargeMixin.userByteSizeLimit`, volatile for the same reason (a
       * force-load must not leak into a saved session).
       */
      userFeatureDensityLimit: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get derivedRegionTooLargeEnabled() {
        return true
      },
      /**
       * #getter
       * Turns off the density (features-per-pixel) axis, leaving only the byte
       * budget. Byte-only displays override this to `true`: e.g.
       * `LinearMultiRowFeatureDisplay` paints features into fixed lanes, so a high
       * total feature count is not a per-glyph render cost — only the download
       * (byte) budget should gate it.
       */
      get densityGateDisabled() {
        return false
      },
      /**
       * #getter
       * The adapter's own `fetchSizeLimit` slot (undefined when the adapter type
       * has none); `resolveByteLimit` prefers it over the display config.
       */
      get adapterFetchSizeLimit(): number | undefined {
        return readConfObject(host(self).adapterConfig, 'fetchSizeLimit')
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
       * The density budget passed to the worker and used by the derived verdict:
       * undefined (gate off) under a declarative/byte force-load or below
       * AUTO_FORCE_LOAD_BP; otherwise the density force-load ceiling or the config.
       */
      get maxFeatureDensity(): number | undefined {
        return self.densityGateDisabled ||
          host(self).configForceLoad ||
          host(self).userByteSizeLimit !== undefined ||
          gateView(self).visibleBp < AUTO_FORCE_LOAD_BP
          ? undefined
          : (self.userFeatureDensityLimit ??
              getConf(host(self), 'maxFeatureScreenDensity'))
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
       * Compressed-byte budget for the fetch RPC, which short-circuits an
       * over-budget region before downloading features. Undefined (unlimited)
       * under force-load or below the gate floor; else `resolveByteLimit`
       * (user force-load → adapter limit → display config).
       */
      byteSizeLimit(): number | undefined {
        return host(self).configForceLoad ||
          gateView(self).visibleBp < AUTO_FORCE_LOAD_BP
          ? undefined
          : resolveByteLimit({
              userByteSizeLimit: host(self).userByteSizeLimit,
              adapterFetchSizeLimit: self.adapterFetchSizeLimit,
              configFetchSizeLimit: host(self).configuredFetchSizeLimit,
            })
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
       * Drop the whole cached estimate on chromosome navigation (displayedRegion
       * indices get reused, so a stale entry would gate the new region against the
       * wrong stats). Driven by the mixin's own `afterAttach` below — no composing
       * display has to wire it up.
       */
      clearFeatureGateStats() {
        self.densityStatsPerRegion.clear()
        host(self).setFeatureDensityStats(undefined)
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
      commitFeatureGateStats(results: FeatureGateRegionResult[]) {
        let maxBytes = 0
        for (const {
          displayedRegionIndex,
          regionWidthBp,
          bytes,
          featureCount,
        } of results) {
          maxBytes = Math.max(maxBytes, bytes ?? 0)
          if (featureCount !== undefined) {
            self.setDensityStats(displayedRegionIndex, {
              featureCount,
              regionWidthBp,
            })
          }
        }
        host(self).setFeatureDensityStats({
          bytes: maxBytes,
          fetchSizeLimit: self.adapterFetchSizeLimit,
        })
      },
      /**
       * #action
       * Dual-axis force-load: clear both user ceilings, then raise exactly the one
       * axis that's actually blocking (`resolveForceLoadLimits` — byte only when it
       * lifts the baseline, else density).
       */
      setFeatureDensityStatsLimit(stats?: { bytes?: number }) {
        // Clear first so maxFeatureDensity (undefined while userByteSizeLimit is
        // set) re-evaluates for the density branch.
        host(self).userByteSizeLimit = undefined
        self.userFeatureDensityLimit = undefined
        const limits = resolveForceLoadLimits({
          estimatedVisibleBytes: host(self).estimatedVisibleBytes,
          rawBytes: stats?.bytes,
          baselineByteLimit: resolveByteLimit({
            userByteSizeLimit: undefined,
            adapterFetchSizeLimit: self.adapterFetchSizeLimit,
            configFetchSizeLimit: host(self).configuredFetchSizeLimit,
          }),
          densityGateActive: self.maxFeatureDensity !== undefined,
          observedMaxDensity: self.observedMaxDensity(gateView(self).bpPerPx),
          configuredMaxDensity: getConf(host(self), 'maxFeatureScreenDensity'),
        })
        host(self).userByteSizeLimit = limits.userByteSizeLimit
        self.userFeatureDensityLimit = limits.userFeatureDensityLimit
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
            self.clearFeatureGateStats()
          },
          'CanvasFeatureGateClearOnNav',
        )
      },
    }))
}
