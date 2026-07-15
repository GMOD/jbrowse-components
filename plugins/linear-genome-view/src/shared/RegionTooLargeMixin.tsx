import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import {
  evaluateRegionTooLarge,
  raiseLimitPast,
  resolveByteLimit,
  scaleByteEstimate,
  scaledForceLoadByteLimit,
} from './featureDensityUtils.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'

/**
 * Shared mixin owning "region too large" state and force-load UI.
 *
 * Composed by MultiRegionDisplayMixin (canvas/GPU displays like
 * LinearAlignmentsDisplay, LinearWiggleDisplay, LinearBasicDisplay) and
 * directly by the SVG arc displays (LinearArcDisplay, LinearPairedArcDisplay),
 * which do their own byte-estimate gating in fetchArcFeatures.
 *
 * Owns the state that TooLargeMessage reads: regionTooLarge,
 * regionTooLargeReason, forceLoad.
 *
 * ## Derived, self-releasing gate
 *
 * `regionTooLarge` is a pure function of the cached byte estimate scaled to the
 * current viewport (`tooLargeStatus`), so the banner self-releases on zoom-in
 * without a flag-clear round trip and doesn't flicker on pan. A byte-gated
 * display opts in by overriding three hooks — `derivedRegionTooLargeEnabled` →
 * true, `configuredFetchSizeLimit` (the mixin owns no `configuration`), and, if
 * it has a second gating axis, `densityTooLargeForDerivedGate` (canvas's
 * feature-density gate) — and clears the cached estimate on chromosome nav with
 * `onDisplayedRegionsChange(self, () => self.setFeatureDensityStats(undefined))`
 * in its `afterAttach` (the estimate intentionally survives viewport-change
 * clears, so only region navigation drops it). Used by
 * canvas/LD/arc/maf/MultiSampleVariant/alignments.
 *
 * A display that leaves `derivedRegionTooLargeEnabled` false never gates on size
 * (`regionTooLarge` is a literal false, so the LGV-only `tooLargeStatus` getters
 * aren't evaluated — safe for non-byte / non-LGV consumers like synteny). The
 * old imperative `setRegionTooLarge` flag path was removed once every byte-gated
 * display went derived.
 *
 * #stateModel RegionTooLargeMixin
 * #category display
 */
export default function RegionTooLargeMixin() {
  return types
    .model('RegionTooLargeMixin', {
      /**
       * #property
       * user-confirmed byte limit after a force-load, disabling the gate
       */
      userByteSizeLimit: types.maybe(types.number),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      featureDensityStats: undefined as FeatureDensityStats | undefined,
      /**
       * #volatile
       * visibleBp at which the current `featureDensityStats` byte estimate was
       * captured, so the derived gate (`estimatedVisibleBytes`) can scale it to
       * the current view. Written by `setFeatureDensityStats`; ignored unless
       * `derivedRegionTooLargeEnabled`.
       */
      byteEstimateVisibleBp: undefined as number | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       * Opt-in switch: a byte-gated display flips this true to enable the derived,
       * self-releasing region-too-large gate. Default false means the display
       * never gates on size (`regionTooLarge` is always false), so non-byte
       * displays (wiggle, manhattan, sequence, synteny, …) don't evaluate the
       * LGV-only `tooLargeStatus` getters at all.
       */
      get derivedRegionTooLargeEnabled(): boolean {
        return false
      },
      /**
       * #getter
       * The composing display's configured `fetchSizeLimit`. This mixin owns no
       * `configuration`, so a derived display overrides this with
       * `getConf(self, 'fetchSizeLimit')`. Only read when the derived gate is
       * enabled; the default matches the BaseLinearDisplay slot default.
       */
      get configuredFetchSizeLimit(): number {
        return 1_000_000
      },
      /**
       * #getter
       * Extra (non-byte) too-large axis folded into the derived verdict — canvas
       * overrides it with its feature-density gate. Byte-only derived displays
       * leave it false.
       */
      get densityTooLargeForDerivedGate(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The cached byte estimate scaled from the span it was measured over
       * (`byteEstimateVisibleBp`) to the currently visible span. Roughly
       * proportional to span, so scaling makes the derived verdict a pure
       * function of the current view and self-releases on zoom-in — without it a
       * large zoomed-out estimate stays above the limit forever and gates
       * refetch. Only meaningful when `derivedRegionTooLargeEnabled`.
       */
      get estimatedVisibleBytes() {
        const view = getContainingView(self) as LinearGenomeViewModel
        // Guard: `visibleBp` reads `view.width`, which throws before the view is
        // measured. A bare getter must never throw, and there's no estimate to
        // scale without a viewport, so yield undefined until the view is ready.
        return view.initialized
          ? scaleByteEstimate({
              bytes: self.featureDensityStats?.bytes,
              captureBp: self.byteEstimateVisibleBp,
              visibleBp: view.visibleBp,
            })
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then
       * bytes-over-limit, then the density axis), fed the scaled estimate so the
       * byte gate self-releases on zoom-in. Same helper as every other gating
       * path so the banner text can't drift.
       */
      get tooLargeStatus() {
        const view = getContainingView(self) as LinearGenomeViewModel
        // Not too large until the view is measured (visibleBp reads view.width,
        // which throws pre-init); the banner never shows before first paint.
        return view.initialized
          ? evaluateRegionTooLarge({
              visibleBp: view.visibleBp,
              bytes: self.estimatedVisibleBytes,
              byteLimit: resolveByteLimit({
                userByteSizeLimit: self.userByteSizeLimit,
                adapterFetchSizeLimit: self.featureDensityStats?.fetchSizeLimit,
                configFetchSizeLimit: self.configuredFetchSizeLimit,
              }),
              densityTooLarge: self.densityTooLargeForDerivedGate,
            })
          : { tooLarge: false, reason: '' }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get regionTooLarge() {
        return self.derivedRegionTooLargeEnabled
          ? self.tooLargeStatus.tooLarge
          : false
      },

      /**
       * #getter
       */
      get regionTooLargeReason() {
        return self.derivedRegionTooLargeEnabled
          ? self.tooLargeStatus.reason
          : ''
      },
    }))
    .views(self => ({
      /**
       * #method
       * Plaintext reason (for SVG export); the on-screen too-large UI is
       * rendered by the display chrome via `TooLargeMessage`, not the model.
       */
      regionCannotBeRenderedText() {
        return self.regionTooLarge ? 'Force load to see features' : ''
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Commits the byte estimate and records the span it was measured at
       * (`byteEstimateVisibleBp`) so the derived gate can scale it to the current
       * view. The capture is harmless for non-gated displays (they ignore it).
       */
      setFeatureDensityStats(stats?: FeatureDensityStats) {
        self.byteEstimateVisibleBp = stats
          ? (getContainingView(self) as LinearGenomeViewModel).visibleBp
          : undefined
        self.featureDensityStats = stats
      },

      /**
       * #action
       * force-load: raise the byte limit past the current request so the gate
       * releases. Raises past the estimate scaled to the *current* view (not the
       * raw captured bytes), so it clears even if the view zoomed out after the
       * estimate was captured; `raiseLimitPast` is the raw fallback for a display
       * with no scaled estimate. Canvas (which also has a density force-load)
       * overrides this entirely.
       */
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        const limit = self.derivedRegionTooLargeEnabled
          ? scaledForceLoadByteLimit({
              scaledEstimate: self.estimatedVisibleBytes,
              rawBytes: stats?.bytes,
            })
          : stats?.bytes
            ? raiseLimitPast(stats.bytes)
            : undefined
        if (limit !== undefined) {
          self.userByteSizeLimit = limit
        }
      },

      /**
       * #action
       */
      reload() {
        // no-op, overridden by composing display models
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Raises the byte limit past the current density stats and triggers a
       * reload. The display chrome calls this via TooLargeMessage's force-load
       * button; concrete display models override reload() to do the actual
       * refetch.
       */
      forceLoad() {
        self.setFeatureDensityStatsLimit(self.featureDensityStats)
        self.reload()
      },
    }))
}
