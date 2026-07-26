import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'

import { AUTO_FORCE_LOAD_BP } from '../LinearGenomeView/model.ts'
import {
  NOT_TOO_LARGE,
  evaluateRegionTooLarge,
  rescaleByteEstimateToVisibleSpan,
  resolveByteLimit,
} from './regionTooLargeUtils.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RegionByteEstimate } from '@jbrowse/core/data_adapters/BaseAdapter/types'

// `visibleBp` reads `view.width`, which throws before the view is measured, and
// nothing gates before first paint anyway.
function viewWiderThanForceLoadFloor(self: object) {
  const view = getContainingView(self) as LinearGenomeViewModel
  return view.initialized && view.visibleBp >= AUTO_FORCE_LOAD_BP
}

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
 * without a flag-clear round trip and doesn't flicker on pan.
 *
 * A pre-flight display opts in with two lines and nothing else: override
 * `byteGateEnabled` to true, and `await self.byteGateBlocksFetch(regions, ctx)`
 * at the top of its fetch, returning if it says so. Both live here, so the
 * measurement and the verdict can't drift apart and the "capture `visibleBp`
 * before the await" rule is structural rather than a call-site convention.
 * (`MultiRegionDisplayMixin.fetchRegions` already makes that call, so displays
 * in that family write only the first line.) Add
 * `densityTooLarge` for a second gating axis (canvas's feature-density
 * gate); the budget hooks default off the display config.
 *
 * `MultiRegionDisplayMixin` drops the cached estimate on chromosome nav for
 * everything it composes; the two displays outside that family (LD, arc) wire
 * `onDisplayedRegionsChange(self, () => self.clearByteEstimate())` themselves.
 * The estimate intentionally survives viewport-change clears, so only region
 * navigation drops it. Used by canvas/LD/arc/maf/MultiSampleVariant/alignments.
 *
 * A display that opts into neither axis never gates on size (`regionTooLarge` is
 * a literal false, so the LGV-only `tooLargeStatus` getters aren't evaluated —
 * safe for non-byte / non-LGV consumers like synteny). The old imperative
 * `setRegionTooLarge` flag path was removed once every byte-gated display went
 * derived.
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
       * The force-load button's answer: render this track regardless of region
       * size or feature density. One boolean for the whole track, not a raised
       * ceiling per region — the banner already tells the user how much data is
       * involved, so one informed click approves the track and they never have to
       * re-approve it per locus.
       *
       * Volatile, not persisted, so it can't leak a disabled gate into a saved or
       * shared session (a recipient would download the same data with no warning
       * and no way to see why). A page load re-arms the gate. The durable,
       * declarative equivalent is the `forceLoad` config slot, for session specs,
       * embeds and `jbrowse-img --force`.
       */
      forceLoadTrack: false,
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
       * The one opt-in a pre-flight display writes: true means "measure this
       * fetch and gate on it". `byteGateBlocksFetch` reads it (so a display that
       * calls the gate unconditionally still pays no RPC when it's off) and so
       * does the verdict, which is why requesting the estimate and gating on it
       * can't drift apart. MAF flips it off in summary mode, LD for
       * pre-computed adapters.
       */
      get byteGateEnabled(): boolean {
        return false
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
       * Second (non-byte) too-large axis folded into the derived verdict — canvas
       * overrides it with its feature-density gate. Byte-only derived displays
       * leave it false.
       */
      get densityTooLarge(): boolean {
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
       * Whether the derived, self-releasing gate is live at all — the union of
       * the two ways a display can measure: a pre-flight estimate
       * (`byteGateEnabled`) or a byte check folded into its own feature RPC
       * (`gateFoldedIntoFetch`). Additive, never an override, so a gate mixin's
       * opt-in doesn't hinge on which side of `.compose()` it lands on. False
       * for the non-byte displays (wiggle, manhattan, sequence, synteny), which
       * therefore never evaluate the LGV-only `tooLargeStatus` getters.
       */
      get derivedRegionTooLargeEnabled(): boolean {
        return self.byteGateEnabled || self.gateFoldedIntoFetch
      },
      /**
       * #getter
       * The adapter's byte budget, preferring one the estimate computed
       * dynamically over the static `fetchSizeLimit` slot. One getter, because
       * the banner, the force-load baseline and the canvas worker budget each
       * spelling "the adapter's limit" for itself is how the worker ends up
       * rejecting a region the banner considers fine — a silently blank display
       * with nothing to refetch it.
       */
      get resolvedAdapterByteLimit() {
        return self.byteEstimate?.fetchSizeLimit ?? self.adapterFetchSizeLimit
      },
      /**
       * #getter
       * True when nothing may gate, on either axis and in both the worker and the
       * banner: a self-summarizing adapter (BigWig/HiC cap what they return at
       * screen resolution), the declarative `forceLoad` slot, or the force-load
       * button. One boolean is the whole force-load mechanism — there is no
       * per-region ceiling to carry, expire, or reconcile between the two axes.
       */
      get byteGateExempt() {
        return (
          !!self.byteEstimate?.alwaysRender ||
          self.configForceLoad ||
          self.forceLoadTrack
        )
      },
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
       * The byte budget the gate enforces: the adapter's limit, else the display
       * config. Also what canvas hands the worker, so the two can't gate against
       * different numbers. Force-load doesn't raise this — it exempts the track
       * outright via `byteGateExempt`.
       */
      get gateByteLimit() {
        return resolveByteLimit({
          adapterFetchSizeLimit: self.resolvedAdapterByteLimit,
          configFetchSizeLimit: self.configuredFetchSizeLimit,
        })
      },
      /**
       * #getter
       * Whether anything may gate at this moment: the display opted in, nothing
       * exempts it, and the view is measured and wider than the
       * `AUTO_FORCE_LOAD_BP` force-load floor.
       *
       * The single home of that question. Everything downstream reads it instead
       * of restating it: the verdict, the pre-flight (no estimate RPC when
       * nothing could act on it), and canvas's two worker budgets, which go
       * undefined together here rather than each re-deriving the floor. The floor
       * used to be spelled out in three places at three layers, which is a
       * standing invitation for them to disagree.
       */
      get gateActive(): boolean {
        // The view is consulted only past the two cheap terms, so a display that
        // never gates — including a non-LGV consumer of this mixin — never
        // touches `getContainingView`.
        return self.derivedRegionTooLargeEnabled && !self.byteGateExempt
          ? viewWiderThanForceLoadFloor(self)
          : false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The verdict the whole mixin exists to produce, with the banner text: true
       * when the estimated download for the span on screen exceeds the resolved
       * byte budget, or when the display's own density axis trips (bytes take
       * precedence for the text). Derived from the rescaled estimate, so it
       * releases itself on zoom-in; false whenever `gateActive` is false.
       *
       * The fetch autoruns hold off while `regionTooLarge` is true, and
       * `DisplayChrome` renders the banner from `regionTooLargeReason`.
       */
      get tooLargeStatus() {
        return self.gateActive
          ? evaluateRegionTooLarge({
              estimatedBytesForVisibleSpan: self.estimatedBytesForVisibleSpan,
              byteLimit: self.gateByteLimit,
              densityTooLarge: self.densityTooLarge,
            })
          : NOT_TOO_LARGE
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get regionTooLarge() {
        return self.tooLargeStatus.tooLarge
      },

      /**
       * #getter
       * Which axis tripped, as banner text: the estimated download size, or
       * "Too many features". Empty string when the region isn't too large.
       */
      get regionTooLargeReason() {
        return self.tooLargeStatus.reason
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
       *
       * `forceLoadTrack` deliberately survives: it is a track-wide approval, so
       * expiring it on navigation is exactly the per-locus re-approval the button
       * exists to avoid.
       */
      clearByteEstimate() {
        self.byteEstimate = undefined
        self.measuredSpanBp = undefined
      },

      /**
       * #action
       * Exempt this track from the gate (or put it back under it). Separate from
       * `forceLoad` so turning the gate off and refetching stay separable — a
       * caller that just wants the flag (a revoke, a test) doesn't trigger a
       * fetch, and `forceLoad` doesn't have to inline a volatile write.
       */
      setForceLoadTrack(flag: boolean) {
        self.forceLoadTrack = flag
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
       * Force-load: exempt this track from the gate and refetch. One click covers
       * every region and both axes, informed by the size the banner just quoted.
       * The display chrome calls this from TooLargeMessage's button; concrete
       * display models override `reload()` to do the actual refetch.
       */
      forceLoad() {
        self.setForceLoadTrack(true)
        self.reload()
      },

      /**
       * #action
       * The entire pre-flight gate for one fetch: measure the region set, commit
       * the estimate with the span it covers, and answer whether the caller must
       * abandon the fetch — either superseded mid-measure, or over budget.
       *
       * Every pre-flight caller (`fetchRegions` for the MultiRegionDisplayMixin
       * family, LD and arc from their own global fetches) calls this and returns
       * on true. Sequencing the steps at a call site is what used to go wrong:
       * `visibleBp` is read here, *before* the await, so the estimate is anchored
       * to the span it actually covers — a re-read afterwards would pin it to
       * whatever a mid-fetch zoom left on screen, and since the fetch autoruns
       * skip while `regionTooLarge` holds, an over-anchored estimate wedges the
       * banner with no refetch to correct it.
       */
      async byteGateBlocksFetch(
        regions: {
          refName: string
          start: number
          end: number
          assemblyName: string
        }[],
        ctx: { isStale: () => boolean },
      ) {
        // Skip the RPC when this display doesn't measure by pre-flight at all
        // (canvas folds the check into its feature fetch), and when nothing could
        // act on an estimate right now — exempt track, or under the force-load
        // floor.
        if (!self.byteGateEnabled || !self.gateActive) {
          return false
        }
        const { visibleBp } = getContainingView(self) as LinearGenomeViewModel
        const estimate = await getSession(self).rpcManager.call(
          getRpcSessionId(self),
          'CoreGetRegionByteEstimate',
          { regions, adapterConfig: host(self).adapterConfig },
        )
        if (ctx.isStale()) {
          return true
        }
        self.setByteEstimate(estimate, visibleBp)
        // Read after the commit: the verdict is a pure function of the estimate
        // × current viewport, and the estimate was just captured at that
        // viewport.
        return self.regionTooLarge
      },
    }))
}
