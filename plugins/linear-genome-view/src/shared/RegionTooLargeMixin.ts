import { getConf, readConfObject } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import {
  AUTO_FORCE_LOAD_BP,
  NOT_TOO_LARGE,
  evaluateRegionTooLarge,
  rescaleByteEstimateToVisibleSpan,
  resolveByteLimit,
} from './regionTooLargeUtils.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { ByteEstimate } from './regionTooLargeUtils.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// The mixin declares no `configuration` / `adapterConfig`, but every display
// that composes it has both (BaseDisplay via MultiRegionDisplayMixin, or the SVG
// arc displays directly). Cast once so the config-slot defaults below read them
// type-safely — the same pattern CanvasFeatureGateMixin uses.
function host(self: object) {
  return self as {
    configuration: AnyConfigurationModel
    // A resolved snapshot (`getConf(track, 'adapter')`), not a config node —
    // which is why `adapterFetchSizeLimit` below reads its slot off the track's
    // live config instead. Typed as what it is, so `byteGateAdapterConfig` can
    // be overridden with a sub-adapter snapshot without a cast.
    adapterConfig: Record<string, unknown>
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
       * The last byte measurement for this display: the estimated bytes **and the
       * span they cover**, which is what lets the derived gate rescale them to the
       * span on screen now. One volatile rather than two, because the pair is a
       * single measurement — written together by `setByteEstimate`, dropped
       * together by `clearByteEstimate`, and meaningless apart. Survives
       * `clearAllRpcData` so an ordinary viewport change doesn't flicker the
       * banner; only chromosome navigation drops it. Ignored unless
       * `derivedRegionTooLargeEnabled`.
       */
      byteEstimate: undefined as ByteEstimate | undefined,
    }))
    .views(self => ({
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
      /**
       * #getter
       * The one opt-in a pre-flight display writes: true means "measure this
       * fetch and gate on it". `byteGateBlocksFetch` reads it (so a display that
       * calls the gate unconditionally still pays no RPC when it's off) and so
       * does the verdict, which is why requesting the estimate and gating on it
       * can't drift apart.
       *
       * Turn it off only for a fetch that **cannot be measured** — LD's
       * pre-computed adapters aren't feature adapters, so
       * `CoreGetRegionByteEstimate` would throw. Not for one believed to be
       * small: a display that reads a cheaper file at some zooms points
       * `byteGateAdapterConfig` at that file and stays gated, which is what MAF
       * does. Off means nothing is watching, and "this tier is cheap" is a
       * premise, not a bound.
       */
      get byteGateEnabled(): boolean {
        return false
      },
      /**
       * #getter
       * Which adapter the pre-flight measures. The display's own by default —
       * correct wherever a display has one fetch path.
       *
       * A display that swaps tiers by zoom overrides it, so the estimate always
       * describes the fetch that is actually about to happen. MAF is the case it
       * was built for: past the force-load floor it reads a `summaryAdapter`
       * instead of the alignment, and measuring the alignment there would quote a
       * download nobody is doing. The alternative it replaced — turning
       * `byteGateEnabled` off for the cheap tier — exempted that tier from the
       * gate entirely, which is only safe if the tier really is bounded. A
       * `BigBedAdapter` read is a full-feature download (see its `getFeatures`),
       * so at genome scale it is not, and the exemption was hiding it.
       */
      get byteGateAdapterConfig(): Record<string, unknown> {
        return host(self).adapterConfig
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
       * Opt out of the `AUTO_FORCE_LOAD_BP` floor: keep gating however far in the
       * user zooms, and let the byte estimate alone decide. Off by default,
       * because the floor is right for every format whose bytes really are
       * proportional to span — below 20kb the fetch is small, and a banner asking
       * permission costs more than the download.
       *
       * A display turns it on when that premise is false for it, which is the
       * same shape twice so far: the file costs bytes per reference base **times
       * a second dimension the view doesn't shrink**. MAF, species count — a
       * 470-way pulls megabases of aligned sequence out of a gene-sized window.
       * Alignments, depth — an amplicon or mitochondrial pileup is tens of MB in
       * the same window. Both are the fetch the floor was least equipped to
       * judge, and the one it declined to look at.
       *
       * **Turning this on cannot block anything that worked at every zoom.** The
       * estimate comes from an index, and a wider query overlaps a superset of
       * index bins, so it is monotone non-decreasing in span: an estimate that
       * clears the cap below the floor cleared it at 20kb too. So every region
       * this newly stops is one that already banners as soon as the user zooms
       * out past the floor — which makes the floor a way to *bypass* that
       * verdict, downloading the bytes the gate refused one zoom level earlier,
       * rather than a policy about small fetches. Whether that argues for
       * dropping the floor outright is open; the density axis on the canvas gate
       * is not monotone the same way, and nothing has measured it down there.
       *
       * Deliberately narrower than it sounds: it removes the floor from
       * `gateActive` only. `aboveForceLoadFloor` keeps its own meaning, so MAF's
       * summary swap still happens at 20kb — the zoom where the cheap tier starts
       * paying off is a rendering question and has no reason to move with this.
       */
      get gateBelowForceLoadFloor(): boolean {
        return false
      },
      /**
       * #getter
       * The adapter's own `fetchSizeLimit` slot (undefined when the adapter type
       * declares none); `resolveByteLimit` prefers it over the display config.
       * Read on the main thread, and only here — the estimate that crosses the
       * worker boundary carries bytes and nothing else, so the banner and the
       * worker budget have no second spelling of "the adapter's limit" to
       * disagree about.
       *
       * A slot **path off the live config**, not a read off `self.adapterConfig`:
       * that getter is a snapshot, which by design omits slots sitting at their
       * default, so a BAM's declared 5 Mb read back as `undefined` in every config
       * that doesn't restate it. Resolved values come from a config node — see
       * CONFIG_PATTERN.md §"Reading a slot: node, not snapshot".
       */
      get adapterFetchSizeLimit(): number | undefined {
        return readConfObject(getContainingTrack(self).configuration, [
          'adapter',
          'fetchSizeLimit',
        ])
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
      /**
       * #getter
       * The span on screen, or undefined before the view is measured. The gate's
       * only read of the *view* (`adapterFetchSizeLimit` reaches the containing
       * track, and nothing else leaves the display): `visibleBp` reads
       * `view.width`, which throws before measurement and a bare getter must
       * never throw, so the pre-init guard lives here once rather than at each
       * reader.
       */
      get gateVisibleBp(): number | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        return view.initialized ? view.visibleBp : undefined
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
       * Which tier the stored estimate is *about*, as a comparable value. The
       * cached estimate answers "how many bytes would the fetch pull", and a
       * display that swaps `byteGateAdapterConfig` by zoom changes which fetch
       * that is — so past the swap the stored number describes a download nobody
       * is going to do, exactly the way a stale estimate describes the previous
       * chromosome's. Both are dropped, and for the same reason.
       *
       * Stringified rather than compared by reference: `byteGateAdapterConfig`
       * is a snapshot getter, and whether a given display's is referentially
       * stable is not something this mixin should have to rely on. An identity
       * comparison that turned out unstable would clear the estimate on every
       * recompute — a banner that flickers on pan, which is the property the
       * cached estimate exists to provide.
       */
      get byteGateAdapterKey(): string {
        return JSON.stringify(self.byteGateAdapterConfig)
      },
      /**
       * #getter
       * Whether the span on screen is wide enough for the gate to have an
       * opinion at all — the `AUTO_FORCE_LOAD_BP` floor, compared here and
       * nowhere else. False before the view is measured.
       *
       * Deliberately independent of the opt-in and of force-load, so a display
       * whose *own* opt-in depends on the floor can read it without a cycle:
       * MAF's `showSummary` swaps to the cheap summary adapter exactly where the
       * detail fetch would be gated, and `byteGateEnabled` is off while it does.
       * `gateActive` adds the opt-in and exemption terms on top.
       */
      get aboveForceLoadFloor(): boolean {
        const { gateVisibleBp } = self
        return (
          gateVisibleBp !== undefined && gateVisibleBp >= AUTO_FORCE_LOAD_BP
        )
      },
      /**
       * #getter
       * True when nothing may gate, on either axis and in both the worker and the
       * banner: the declarative `forceLoad` slot, or the force-load button. One
       * boolean is the whole force-load mechanism — there is no per-region ceiling
       * to carry, expire, or reconcile between the two axes. A self-summarizing
       * adapter (BigWig, HiC, sequence) needs no term here: it reports no byte
       * estimate at all, which already keeps the byte axis out of the verdict.
       */
      get byteGateExempt() {
        return self.configForceLoad || self.forceLoadTrack
      },
      /**
       * #getter
       * How many bytes we estimate a fetch of the span on screen right now would
       * pull, obtained by rescaling the stored measurement from the span it
       * covers. Rescaling is what makes the derived verdict a pure function of
       * the current view and lets it self-release on zoom-in — without it a large
       * zoomed-out estimate stays above the limit forever and gates refetch. Only
       * meaningful when `derivedRegionTooLargeEnabled`.
       *
       * Self-releasing **above `AUTO_FORCE_LOAD_BP`**. The rescale floors both
       * of its spans there, because an index reports whole blocks and stops
       * resolving span at roughly that width, so below it this getter is flat
       * and the verdict is whatever it was at the floor. Only a display that
       * opted out of the floor ever reads it down there.
       */
      get estimatedBytesForVisibleSpan() {
        const { gateVisibleBp } = self
        return gateVisibleBp === undefined
          ? undefined
          : rescaleByteEstimateToVisibleSpan({
              byteEstimate: self.byteEstimate,
              visibleBp: gateVisibleBp,
            })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The byte budget the gate enforces: the adapter's limit, else the display
       * config. Also what `resolvedByteLimit()` hands the worker, so the two can't
       * gate against different numbers. Force-load doesn't raise this — it exempts
       * the track outright via `byteGateExempt`.
       */
      get gateByteLimit() {
        return resolveByteLimit({
          adapterFetchSizeLimit: self.adapterFetchSizeLimit,
          configFetchSizeLimit: self.configuredFetchSizeLimit,
        })
      },
      /**
       * #getter
       * Whether "zoom in to see features" is still honest advice — the banner
       * offers that way out only when this is true, and force-load alone when it
       * isn't.
       *
       * True for every display that keeps the `AUTO_FORCE_LOAD_BP` floor, since
       * the floor guarantees the gate lets go eventually. For one that opted out,
       * true only while still above the floor, where zooming does shrink the
       * fetch. Below it there is nothing left for zoom to do: 20kb is roughly
       * where a tabix/BAI index stops resolving span (16kb linear bins), so the
       * estimate is flat and the same bytes come down however far the user goes.
       *
       * That the floor sits at about the index's own resolution is what made
       * "zoom in to see features" safe to print unconditionally for as long as
       * nothing gated below it, and why opting out of the floor has to come with
       * this.
       *
       * The gate agrees rather than merely the banner: `rescaleByteEstimate
       * ToVisibleSpan` floors both its spans at the same constant, so below the
       * floor the estimate is flat and zooming genuinely cannot release it. It
       * used to release anyway, on a number the index does not charge, and the
       * pre-flight put the banner straight back.
       */
      get zoomCanReleaseGate(): boolean {
        return !self.gateBelowForceLoadFloor || self.aboveForceLoadFloor
      },
      /**
       * #getter
       * Whether anything may gate at this moment: the display opted in, nothing
       * exempts it, and the view is measured and above the force-load floor.
       *
       * The single home of that question. Everything downstream reads it instead
       * of restating it: the verdict, the pre-flight (no estimate RPC when
       * nothing could act on it), and the worker budgets, which go undefined
       * together here rather than each re-deriving the floor. The floor used to
       * be spelled out in three places at three layers, which is a standing
       * invitation for them to disagree.
       */
      get gateActive(): boolean {
        // The view is consulted only past the two cheap terms, so a display that
        // never gates — including a non-LGV consumer of this mixin — never
        // touches `getContainingView`.
        if (!self.derivedRegionTooLargeEnabled || self.byteGateExempt) {
          return false
        }
        // A floor opt-out still requires a measured view: with no `visibleBp`
        // there is nothing to rescale the estimate to, so the verdict would be
        // false anyway and the pre-flight RPC would be issued for nothing.
        return self.gateBelowForceLoadFloor
          ? self.gateVisibleBp !== undefined
          : self.aboveForceLoadFloor
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

      /**
       * #method
       * The byte budget a fetch RPC enforces worker-side, short-circuiting an
       * over-budget region before it downloads any features. Undefined
       * (unlimited) when nothing gates; otherwise the very number the banner
       * compares against, so the worker can't reject a region the banner then
       * calls fine. Lives here, not on the canvas gate that consumes it, because
       * both its terms are this mixin's — canvas owns only the density axis.
       */
      resolvedByteLimit(): number | undefined {
        return self.gateActive ? self.gateByteLimit : undefined
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
       * Commits a byte measurement: the estimate together with the span it
       * covers, so the derived gate can rescale it to the span on screen.
       * `measuredSpanBp` must be the `visibleBp` captured when the measurement
       * was *requested*, not read at commit time: a view that zoomed during the
       * in-flight fetch would otherwise anchor the estimate to a span it never
       * covered, and since `FetchVisibleRegions` skips while `regionTooLarge`
       * holds, an over-anchored estimate wedges the banner with no refetch to
       * correct it. Harmless for non-gated displays (they ignore it).
       */
      setByteEstimate(estimate: ByteEstimate) {
        self.byteEstimate = estimate
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
       * the span is read here, *before* the await, so the estimate is anchored to
       * the span it actually covers — a re-read afterwards would pin it to
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
        // act on an estimate right now — exempt track, unmeasured view, or under
        // the force-load floor unless the display opted out of it. `gateActive`
        // already implies a measured view on both of its branches; the
        // `undefined` test survives only because `setByteEstimate` below needs
        // the narrowed number.
        const measuredSpanBp = self.gateVisibleBp
        if (
          !self.byteGateEnabled ||
          measuredSpanBp === undefined ||
          !self.gateActive
        ) {
          return false
        }
        const bytes = await getSession(self).rpcManager.call(
          getRpcSessionId(self),
          'CoreGetRegionByteEstimate',
          { regions, adapterConfig: self.byteGateAdapterConfig },
        )
        if (ctx.isStale()) {
          return true
        }
        self.setByteEstimate({ bytes, measuredSpanBp })
        // Read after the commit: the verdict is a pure function of the estimate
        // × current viewport, and the estimate was just captured at that
        // viewport.
        return self.regionTooLarge
      },
    }))
    .actions(self => ({
      // The fork auto-chains afterAttach, so this runs alongside the composing
      // display's own without either calling super.
      afterAttach() {
        // Drop the cached estimate when the tier it measured stops being the
        // tier we would fetch. `clearByteEstimate` on chromosome nav already
        // handles "these bytes are about a different region"; this is the same
        // rule on the other axis, "these bytes are about a different file", and
        // it wedges the same way if skipped: MAF captures a 470-way detail
        // estimate below 20kb, zooms out into the cheap summary tier, and the
        // detail number rescales UP (3 Mb over 8 kb reads as 29 Mb over 80 kb)
        // and banners a summary read that would have measured ~60 kB. The fetch
        // autoruns skip while `regionTooLarge` holds and the pre-flight is the
        // only thing that re-measures, so nothing corrects it and zooming out
        // further only makes it worse.
        //
        // Owned here rather than left to the swapping display, for the reason
        // CanvasFeatureGateMixin owns its own stale-stat cleanup: overriding
        // `byteGateAdapterConfig` is the whole opt-in, and a display that has to
        // remember a second wire is a display that silently mis-gates when it
        // doesn't. The read is the autorun's own — an MST action runs untracked,
        // so factoring it into one would leave this with no dependencies and
        // fire it exactly once.
        addDisposer(
          self,
          autorun(
            () => {
              // Guarded so a display that never gates never evaluates
              // `byteGateAdapterConfig` — that getter reaches through the
              // `host()` cast for members this mixin doesn't declare, and
              // "nothing below the opt-in is evaluated" is a property the
              // non-byte composers (wiggle, Manhattan, sequence) rely on.
              if (!self.derivedRegionTooLargeEnabled) {
                return
              }
              void self.byteGateAdapterKey
              self.clearByteEstimate()
            },
            { name: 'ClearByteEstimateOnTierSwap' },
          ),
        )
      },
    }))
}
