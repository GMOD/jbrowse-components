import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import {
  evaluateRegionTooLarge,
  rescaleByteEstimateToVisibleSpan,
  resolveByteLimit,
  resolveForceLoadLimits,
} from './regionTooLargeUtils.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RegionByteEstimate } from '@jbrowse/core/data_adapters/BaseAdapter/types'

// The mixin declares no `configuration` / `adapterConfig`, but every display
// that composes it has both (BaseDisplay via MultiRegionDisplayMixin, or the SVG
// arc displays directly). Cast once so the config-slot defaults below read them
// type-safely — the same pattern CanvasFeatureGateMixin uses.
function host(self: object) {
  return self as {
    configuration: AnyConfigurationModel
    adapterConfig: AnyConfigurationModel
  }
}

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
 * display opts in by flipping `derivedRegionTooLargeEnabled` true, plus
 * `densityTooLargeForDerivedGate` if it has a second gating axis (canvas's
 * feature-density gate). The budget hooks default off the display config, so
 * nothing else needs overriding. `MultiRegionDisplayMixin` drops the cached
 * estimate on chromosome nav for everything it composes; the two displays
 * outside that family (LD, arc) wire `onDisplayedRegionsChange(self, () =>
 * self.clearByteEstimate())` themselves. The estimate intentionally survives
 * viewport-change clears, so only region navigation drops it. Used by
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
    .model('RegionTooLargeMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * user-confirmed byte limit after a force-load, disabling the gate.
       * Volatile, not persisted: the interactive force-load button is a transient
       * "show me this now" action and must not leak a raised gate into a saved or
       * shared session. The declarative, session-scoped escape hatch is instead
       * the `forceLoad` config slot (set per-session via a session spec, or baked
       * into a track config for embedded/notebook views).
       */
      userByteLimit: undefined as number | undefined,
      /**
       * #volatile
       * Last byte estimate reported for this display, with the adapter's own
       * `fetchSizeLimit` and `alwaysRender` flag. Its `bytes` covers
       * `measuredSpanBp`, not the span on screen now. Survives
       * `clearAllRpcData` so an ordinary viewport change doesn't flicker the
       * banner; only chromosome navigation drops it.
       */
      byteEstimate: undefined as RegionByteEstimate | undefined,
      /**
       * #volatile
       * The span the current `byteEstimate` was measured over, so the derived
       * gate can rescale it to the span on screen now. Written by
       * `setByteEstimate`; ignored unless `derivedRegionTooLargeEnabled`.
       */
      measuredSpanBp: undefined as number | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       * Additive opt-in for displays that measure the estimate inside their own
       * feature RPC instead of a pre-flight (canvas). Kept separate from
       * `derivedRegionTooLargeEnabled` so a gate mixin contributes by setting
       * *this* rather than overriding the verdict switch — the two would
       * otherwise race on composition order, and the later `.compose()`
       * argument silently winning is invisible to both the type system and the
       * tests.
       */
      get gateFoldedIntoFetch(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Opt-in switch: a byte-gated display flips this true to enable the derived,
       * self-releasing region-too-large gate. Default false means the display
       * never gates on size (`regionTooLarge` is always false), so non-byte
       * displays (wiggle, manhattan, sequence, synteny, …) don't evaluate the
       * LGV-only `tooLargeStatus` getters at all.
       */
      get derivedRegionTooLargeEnabled(): boolean {
        return self.gateFoldedIntoFetch
      },
      /**
       * #getter
       * The composing display's configured `fetchSizeLimit`, read straight from
       * its config. Only evaluated when the derived gate is enabled (guarded by
       * `derivedRegionTooLargeEnabled`), and every derived display extends
       * `baseLinearDisplayConfigSchema`, which owns the slot — so the read is
       * always valid where it fires. A display with a bespoke source can still
       * override it.
       */
      get configuredFetchSizeLimit(): number {
        return getConf(host(self), 'fetchSizeLimit')
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
      /**
       * #getter
       * The adapter's own `fetchSizeLimit` slot (undefined when the adapter type
       * declares none); `resolveByteLimit` prefers it over the display config.
       * Read on the main thread rather than trusted only from the estimate: the
       * three adapters that attach one (BAM/CRAM/VCF) just echo this same static
       * slot back across the worker boundary, and a display whose adapter never
       * attaches it would otherwise silently ignore a configured limit.
       * `byteEstimate.fetchSizeLimit` still wins where present, so an adapter
       * that computes a limit dynamically keeps the last word.
       */
      get adapterFetchSizeLimit(): number | undefined {
        return readConfObject(host(self).adapterConfig, 'fetchSizeLimit')
      },
      /**
       * #getter
       * Declarative force-load: when true the display always renders regardless
       * of region size / feature density (the config-driven equivalent of the
       * force-load button). Read straight from the `forceLoad` config slot on
       * `baseLinearDisplayConfigSchema` (same guard/ownership as
       * `configuredFetchSizeLimit`), so every opt-in display honors it without
       * per-display wiring.
       */
      get configForceLoad(): boolean {
        return getConf(host(self), 'forceLoad')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * How many bytes we estimate a fetch of the span on screen right now would
       * pull, obtained by rescaling the stored estimate from the span it was
       * measured over (`measuredSpanBp`). Rescaling is what makes
       * the derived verdict a pure function of the current view and lets it
       * self-release on zoom-in — without it a large zoomed-out estimate stays
       * above the limit forever and gates refetch. Only meaningful when
       * `derivedRegionTooLargeEnabled`.
       */
      get estimatedBytesForVisibleSpan() {
        const view = getContainingView(self) as LinearGenomeViewModel
        // Guard: `visibleBp` reads `view.width`, which throws before the view is
        // measured. A bare getter must never throw, and there's no estimate to
        // scale without a viewport, so yield undefined until the view is ready.
        return view.initialized
          ? rescaleByteEstimateToVisibleSpan({
              estimatedBytesForMeasuredSpan: self.byteEstimate?.bytes,
              measuredSpanBp: self.measuredSpanBp,
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
              estimatedBytesForVisibleSpan: self.estimatedBytesForVisibleSpan,
              byteLimit: resolveByteLimit({
                userByteLimit: self.userByteLimit,
                adapterFetchSizeLimit:
                  self.byteEstimate?.fetchSizeLimit ??
                  self.adapterFetchSizeLimit,
                configFetchSizeLimit: self.configuredFetchSizeLimit,
              }),
              densityTooLarge: self.densityTooLargeForDerivedGate,
              // Self-summarizing adapters (BigWig/HiC — cap returned data at
              // screen resolution) never gate. None of the currently gated
              // adapters set it (BigMaf explicitly does NOT), but honoring it
              // here keeps the derived gate matching evaluateRegionTooLarge's
              // contract if one ever does. `configForceLoad` folds in here too:
              // the declarative force-load short-circuits the verdict exactly as
              // a self-summarizing adapter would.
              alwaysRender:
                self.byteEstimate?.alwaysRender || self.configForceLoad,
            })
          : { tooLarge: false, reason: '' }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The verdict the whole mixin exists to produce: true when the estimated
       * download for the span on screen exceeds the resolved byte budget, or
       * when the display's own density axis trips. Derived, so it releases
       * itself on zoom-in. Always false for a display that hasn't opted in via
       * `derivedRegionTooLargeEnabled`. The fetch autoruns hold off while it is
       * true, and `DisplayChrome` renders the banner from it.
       */
      get regionTooLarge() {
        return self.derivedRegionTooLargeEnabled
          ? self.tooLargeStatus.tooLarge
          : false
      },

      /**
       * #getter
       * Which axis tripped, as banner text: the estimated download size, or
       * "Too many features". Empty string when the region isn't too large.
       */
      get regionTooLargeReason() {
        return self.derivedRegionTooLargeEnabled
          ? self.tooLargeStatus.reason
          : ''
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Commits the byte estimate together with the span it covers, so the
       * derived gate can rescale it to the span on screen. `measuredSpanBp`
       * must be the `visibleBp` captured when the measurement was *requested*,
       * not read at commit time: a view that zoomed during the in-flight fetch
       * would otherwise anchor the estimate to the wrong span, and since
       * `FetchVisibleRegions` skips while `regionTooLarge` holds, an
       * over-anchored estimate wedges the banner with no refetch to correct it.
       * Harmless for non-gated displays (they ignore it).
       */
      setByteEstimate(estimate: RegionByteEstimate, measuredSpanBp: number) {
        self.byteEstimate = estimate
        self.measuredSpanBp = measuredSpanBp
      },

      /**
       * #action
       * Drops the cached estimate. Chromosome navigation only: the estimate
       * intentionally survives `clearAllRpcData` so an ordinary viewport change
       * doesn't flicker the banner.
       */
      clearByteEstimate() {
        self.byteEstimate = undefined
        self.measuredSpanBp = undefined
      },

      /**
       * #action
       * force-load: raise the byte limit past the current request so the gate
       * releases. Prefers the estimate for the span on screen now, so it clears
       * even if the view zoomed out since the measurement; a display with the
       * derived gate off has no such estimate and falls back to the
       * measured-span number. Byte-only, so it asks `resolveForceLoadLimits`
       * with the density axis off — canvas overrides with the dual-axis form.
       */
      raiseForceLoadLimits() {
        const { userByteLimit } = resolveForceLoadLimits({
          estimatedBytesForVisibleSpan: self.derivedRegionTooLargeEnabled
            ? self.estimatedBytesForVisibleSpan
            : undefined,
          estimatedBytesForMeasuredSpan: self.byteEstimate?.bytes,
          baselineByteLimit: resolveByteLimit({
            userByteLimit: undefined,
            adapterFetchSizeLimit:
              self.byteEstimate?.fetchSizeLimit ?? self.adapterFetchSizeLimit,
            configFetchSizeLimit: self.configuredFetchSizeLimit,
          }),
          densityGateActive: false,
          observedMaxDensity: 0,
          configuredMaxDensity: 0,
        })
        if (userByteLimit !== undefined) {
          self.userByteLimit = userByteLimit
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
       * Raises the byte limit past the current estimate and triggers a
       * reload. The display chrome calls this via TooLargeMessage's force-load
       * button; concrete display models override reload() to do the actual
       * refetch.
       */
      forceLoad() {
        self.raiseForceLoadLimits()
        self.reload()
      },
    }))
}
