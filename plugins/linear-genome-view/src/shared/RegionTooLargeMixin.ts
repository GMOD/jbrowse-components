import { getConf, readConfObject } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  updateStatus,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, getMembers, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import {
  AUTO_FORCE_LOAD_BP,
  evaluateRegionTooLarge,
  nextByteEstimate,
  resolveByteLimit,
} from './regionTooLargeUtils.ts'

import type { FetchContext } from '../BaseLinearDisplay/models/FetchMixin.ts'
import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { ByteEstimate, GateViewport } from './regionTooLargeUtils.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// This ESM package builds without @types/node, but consuming bundlers still
// string-replace `process.env.NODE_ENV`, so keep the reference and give it a
// minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

// The gate members renamed in 2026-08, and what they are called now. An
// out-of-tree display overriding an old name is the exact failure this mixin
// spends `gateEnabled`'s additive-OR and `CanvasFeatureGateMixin`'s
// compose-order check guarding against: the override lands on a getter nothing
// reads, the gate quietly stays off, and the display downloads whatever it is
// pointed at with no banner and no error. A rename is only safe if it is louder
// than the thing it renamed, so this says so at attach.
export const RENAMED_HOOKS: Record<string, string> = {
  byteGateEnabled: 'measuresBytesPreFlight',
  gateFoldedIntoFetch: 'measuresBytesInFetch',
  derivedRegionTooLargeEnabled: 'gateEnabled',
  byteGateExempt: 'gateExempt',
  byteGateActive: 'gateActive',
  gateVisibleBp: 'gateViewport?.spanBp',
}

// The same failure for a removed hook rather than a renamed one, over ACTIONS
// because that is what these were.
export const REMOVED_ACTION_HOOKS: Record<string, string> = {
  onRegionTooLarge:
    'installClearHoverOnViewportChange, which clears on the `regionTooLarge` ' +
    'flip as well as on the three viewport axes',
}

// Dev-only, from `afterAttach`, so it fires once for every display composing
// this mixin — the only place that sees them all. `console.error` rather than
// `throw` for the reason `assertDisplayContract` gives: an error escaping
// `afterAttach` reads to the session loader as an invalid track and the display
// is dropped, hiding the very violation being reported.
export function reportRenamedHooks(self: IAnyStateTreeNode) {
  if (process.env.NODE_ENV === 'production') {
    return
  }
  const { views, actions, name } = getMembers(self)
  for (const [old, current] of Object.entries(RENAMED_HOOKS)) {
    if (views.includes(old)) {
      console.error(
        `[jbrowse display contract] ${name}: \`${old}\` was renamed to ` +
          `\`${current}\`. Nothing reads the old name any more, so this ` +
          `override is inert and the region-too-large gate may be off for ` +
          `this display. See agent-docs/reference/REGION_TOO_LARGE.md.`,
      )
    }
  }
  for (const [old, replacement] of Object.entries(REMOVED_ACTION_HOOKS)) {
    if (actions.includes(old)) {
      console.error(
        `[jbrowse display contract] ${name}: \`${old}\` was removed. ` +
          `Nothing calls it, so this override never runs — its job is done by ` +
          `${replacement}. See agent-docs/reference/REGION_TOO_LARGE.md.`,
      )
    }
  }
}

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
 * ## Measurement follows the viewport
 *
 * `regionTooLarge` is a pure function of one cached measurement
 * (`tooLargeStatus`), and that measurement is kept describing the viewport it is
 * judging. Two mechanisms, one per state, and between them the estimate is never
 * a model:
 *
 * - **Not gated:** the fetch measures. `byteGateBlocksFetch` runs at the top of
 *   every fetch (canvas measures inside its own feature RPC instead), so every
 *   fetch re-anchors the estimate to what it is about to pull.
 * - **Gated:** the fetch measures anyway, once. `FetchVisibleRegions` and
 *   `installGlobalFetchAutorun` used to return early on `regionTooLarge`, which
 *   froze the estimate at the viewport it was captured over; they skip on
 *   `regionTooLarge && !gateMeasurementStale` instead. So a blocked display runs
 *   one fetch per settled viewport, and that fetch stops at whichever gate
 *   rejected it — which is what releases the banner. No second,
 *   measurement-only RPC path exists, and canvas therefore keeps the single-call
 *   fetch it was built around.
 *
 *   What that costs, precisely, because "it re-fetches while blocked" reads
 *   alarming: on the **byte** axis, one index read and no features, on both
 *   paths. On canvas's **density** axis, the pre-fetch probe
 *   (`samplePreFetchDensity`) — a 1kb sample window, doubling until it has seen
 *   70 features — and then the short-circuit. A region dense enough to be
 *   density-blocked is exactly the region that satisfies that on the first
 *   window, so it is small and bounded, but it is not nothing.
 *
 * There used to be a third thing, a derived `estimatedBytesForVisibleSpan` that
 * scaled the stored bytes by `visibleBp / measuredSpanBp`, and it was the
 * release mechanism. It is gone, because bytes do not follow span: an index
 * quotes whole blocks, so the estimate is a step function whose steps are a
 * property of the file. Measured 2026-08-06, the whole-genome
 * `hs37d5.HG002…sv.vcf.gz` charges an identical 15,408 bytes from 7.8 Mb of span
 * all the way down, where the linear model extrapolated from chr1 predicts 22 —
 * a 700x under-report, in the direction that releases a banner it should hold.
 * Every gated track above the old floor paid for that with a release, an aborted
 * fetch, and a re-banner on each zoom step.
 *
 * A pre-flight display opts in with two lines and nothing else: override
 * `measuresBytesPreFlight` to true, and `await self.byteGateBlocksFetch(regions,
 * ctx)` at the top of its fetch, returning if it says so. Both live here, so the
 * measurement and the verdict can't drift apart and the "capture the viewport
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
 * safe for ungated / non-LGV consumers like synteny). The old imperative
 * `setRegionTooLarge` flag path was removed once every gated display went
 * derived.
 *
 * ## The names, and the one rule behind them
 *
 * **A `byte`/`density` prefix means the term is genuinely about that axis, and
 * nothing else carries one.** The gate reads as three questions asked in order,
 * and the middle one is shared:
 *
 * - *how does this display measure?* — `measuresBytesPreFlight` /
 *   `measuresBytesInFetch`, a pair, with `gateEnabled` as their OR.
 * - *may the gate act right now?* — `gateActive` (opted in, not exempt, view
 *   measured). Nothing axis-specific here.
 * - *may this axis act?* — `gateActive` plus that axis's own terms.
 *   `densityGateActive` adds `densityGateEnabled` and the `AUTO_FORCE_LOAD_BP`
 *   floor; the byte axis adds nothing, which is why it has no getter of its own
 *   and reads `gateActive` directly.
 *
 * Until 2026-08 the middle question was called `byteGateActive` and the
 * exemption `byteGateExempt`, while `densityGateActive` was literally
 * `byteGateActive && …` and `byteGateExempt`'s own first sentence said "on
 * either axis". Two names claiming an axis they had no term from is how a reader
 * comes to believe force-load only lifts the byte gate — which is a thing this
 * mixin's *predecessor* actually did, and one of the four bugs the boolean
 * replaced (see REGION_TOO_LARGE.md § Force-load).
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
       * The last byte measurement for this display: the estimated bytes, the span
       * they were measured at, and whether zooming has been shown not to shrink
       * them. One volatile rather than three, because they are a single
       * measurement — written together by `setByteEstimate`, dropped together by
       * `clearByteEstimate`, and meaningless apart. Survives `clearAllRpcData` so
       * an ordinary viewport change doesn't flicker the banner; the two things
       * that do drop it are chromosome navigation and a tier swap, which are one
       * rule on two axes — the measurement is about a fetch, and each changes
       * which fetch that is. Ignored unless `gateEnabled`.
       */
      byteEstimate: undefined as ByteEstimate | undefined,
      /**
       * #volatile
       * The viewport (`gateViewport().key`) the gate last got a measurement for,
       * on **either** axis. Not part of `byteEstimate`, because a fetch can
       * measure density and no bytes at all — a dense region short-circuits on
       * the feature count with the byte estimate deliberately left alone — and
       * that fetch still asked the adapter about this viewport.
       *
       * Its whole job is `gateMeasurementStale`, which is what lets the fetch
       * autoruns run exactly one fetch per settled viewport while the banner
       * holds. Keying it on bytes instead loops forever on a density rejection.
       */
      gateMeasuredViewportKey: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * One of the two ways a display measures, and the pair is named as a pair
       * on purpose: `gateEnabled` is their OR, so a reader can see that the two
       * are alternatives without being told. This one is "I check the byte cost
       * inside my own feature RPC" (canvas, whose worker short-circuits an
       * over-budget region before downloading features).
       *
       * Additive, never an override of `gateEnabled` — the two would otherwise
       * race on composition order, and the later `.compose()` argument silently
       * winning is invisible to both the type system and the tests.
       */
      get measuresBytesInFetch(): boolean {
        return false
      },
      /**
       * #getter
       * The other half of the pair: "I measure with a pre-flight
       * `CoreGetRegionByteEstimate` before fetching". `byteGateBlocksFetch`
       * reads it (so a display that calls the gate unconditionally still pays no
       * RPC when it's off) and so does the verdict, which is why requesting the
       * estimate and gating on it can't drift apart.
       *
       * **Nothing in the tree turns it off**, and there is no longer a reason
       * to. "Can this adapter be measured" is the adapter's answer, not a
       * display's: one with no index estimate reports `undefined`, one that
       * serves no features at all gets `undefined` from
       * `CoreGetRegionByteEstimate`, and an unmeasurable estimate keeps the byte
       * axis out of the verdict on its own. It is emphatically not for a fetch
       * believed to be small — a display that reads a cheaper file at some zooms
       * points `byteGateAdapterConfig` at that file and stays gated, which is
       * what MAF does. Off means nothing is watching, and "this tier is cheap"
       * is a premise, not a bound.
       */
      get measuresBytesPreFlight(): boolean {
        return false
      },
      /**
       * #getter
       * Whether the **density** (features-per-pixel) axis applies to this
       * display at all. True here because the default is "both axes are on and
       * the display supplies the numbers"; `densityTooLarge` below is what
       * actually costs nothing until a display fills it, so a byte-only display
       * leaves both alone.
       *
       * It lives on this mixin rather than on `CanvasFeatureGateMixin` — where
       * it used to — because it is the second half of a contract whose first
       * half (`densityTooLarge`) is already here, and because a hook the base
       * doesn't know about cannot be folded into `densityGateActive`. It wasn't,
       * and the cost was that "is the density axis on?" had two spellings, both
       * of which had to be asked at the one consumer:
       * `!densityGateEnabled || !densityGateActive`.
       *
       * `LinearMultiRowFeatureDisplay` is the one display that turns it off: it
       * paints into fixed lanes, so a high total feature count is not a
       * per-glyph render cost and only the download budget should gate it.
       */
      get densityGateEnabled(): boolean {
        return true
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
       * `measuresBytesPreFlight` off for the cheap tier — exempted that tier from the
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
       * its config. Only evaluated when the gate is enabled (guarded by
       * `gateEnabled`), and every gated display extends
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
       * What a measurement taken right now would be about: the span on screen,
       * and a comparable identity for the exact stretch of genome it covers.
       * Undefined before the view is measured, which every reader takes as
       * "there is nothing to measure yet".
       *
       * **The gate's only read of the view** — `adapterFetchSizeLimit` reaches
       * the containing track, and nothing else leaves the display — which is
       * also why the pre-init guard lives here once: `visibleBp` reads
       * `view.width`, which throws before measurement, and a bare getter must
       * never throw. There used to be a second getter for the span alone
       * (`gateVisibleBp`), with its own copy of that walk and that guard, read
       * by the two places that wanted a number rather than a label. One quantity
       * under two names is one more thing to keep in step for nothing: both
       * callers now take `gateViewport?.spanBp`, and `gateActive`'s precondition
       * reads as what it means — we know what a measurement would be about.
       *
       * Captured as one value, and captured *before* the round trip, because
       * both halves answer a question about the measurement that cannot be
       * recovered afterwards. The span is what `zoomIneffective` compares across
       * two measurements; the key is what tells the fetch autoruns whether the
       * stored estimate still describes what the user is looking at
       * (`gateMeasurementStale`). Reading either at commit time would label the
       * number with a viewport it never covered.
       *
       * Rounded, because `visibleRegions` carries fractional bp and a key that
       * changed on sub-base jitter would call every estimate stale.
       */
      get gateViewport(): GateViewport | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        return view.initialized
          ? {
              spanBp: view.visibleBp,
              key: view.visibleRegions
                .map(
                  r =>
                    `${r.displayedRegionIndex}:${r.refName}:${Math.floor(r.start)}-${Math.ceil(r.end)}`,
                )
                .join(','),
            }
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether this display measures at all — the union of the two ways it can
       * (`measuresBytesPreFlight`, `measuresBytesInFetch`). Additive, never an
       * override, so a gate mixin's opt-in doesn't hinge on which side of
       * `.compose()` it lands on. False for the ungated displays (wiggle,
       * manhattan, sequence, synteny), which therefore never evaluate the
       * LGV-only getters below.
       *
       * It was `derivedRegionTooLargeEnabled`, which named an implementation
       * detail of 2026 ("the verdict is derived now, not an imperative flag")
       * rather than the question, and was long enough that both opt-ins were
       * named for how they differ from *it* instead of from each other.
       */
      get gateEnabled(): boolean {
        return self.measuresBytesPreFlight || self.measuresBytesInFetch
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
       * Whether the span on screen is above `AUTO_FORCE_LOAD_BP` — that constant
       * compared here and nowhere else. False before the view is measured.
       *
       * Three readers, each doing something different with the same span, which
       * is why this is one getter rather than a term inside any of them: the
       * **density** axis stops gating below it (`densityGateActive`), MAF's
       * `showSummary` swaps to the cheap summary adapter at it, and the **byte**
       * axis multiplies its budget by `SUB_FLOOR_BYTE_BUDGET_FACTOR` below it
       * (`gateByteLimit`).
       *
       * Deliberately independent of the opt-in and of force-load, so a display
       * whose *own* opt-in depends on the floor can read it without a cycle:
       * `byteGateAdapterConfig` is downstream of MAF's swap. The two gate
       * getters add `gateActive` and their axis's own terms on top — so note
       * this is false on an unmeasured view, and a reader that isn't already
       * behind `gateActive` has to say what it wants that to mean.
       */
      get aboveForceLoadFloor(): boolean {
        const spanBp = self.gateViewport?.spanBp
        return spanBp !== undefined && spanBp >= AUTO_FORCE_LOAD_BP
      },
      /**
       * #getter
       * True when nothing may gate, on either axis and in both the worker and the
       * banner: the declarative `forceLoad` slot, or the force-load button. One
       * boolean is the whole force-load mechanism — there is no per-region ceiling
       * to carry, expire, or reconcile between the two axes. A self-summarizing
       * adapter (BigWig, HiC, sequence) needs no term here: it reports no byte
       * estimate at all, which already keeps the byte axis out of the verdict.
       *
       * It was `byteGateExempt`, while its own first sentence said "on either
       * axis" — force-load has never lifted only the byte gate, and a name
       * claiming an axis it has no term from is how a reader comes to believe it
       * does.
       */
      get gateExempt() {
        return self.configForceLoad || self.forceLoadTrack
      },
      /**
       * #getter
       * How many bytes we estimate the fetch this display would issue right now
       * would pull. The stored measurement, unmodified — the viewport it
       * describes is kept current by re-measuring rather than by scaling it (see
       * the mixin docstring). Undefined when nothing has been measured — which
       * includes the adapter offering no index estimate, since neither path
       * stores one for that — and that keeps the byte axis out of the verdict
       * entirely.
       */
      get estimatedFetchBytes() {
        return self.byteEstimate?.bytes
      },
      /**
       * #getter
       * Whether the gate's last measurement is about a viewport the user has
       * since left. True when there has been no measurement at all.
       *
       * **This is what lets the gate release.** The fetch autoruns skip while
       * `regionTooLarge` holds — they have to, or a too-large region would
       * refetch forever off its own `fetchGeneration` bump — and skipping is
       * also what leaves the verdict frozen at the viewport it was taken at. So
       * they skip on `regionTooLarge && !gateMeasurementStale` instead: one fetch
       * per settled viewport while blocked, and none once that viewport has been
       * measured.
       *
       * Running the ordinary fetch is the whole re-measure, because every gated
       * display's fetch begins by measuring and stops there when the answer is
       * over budget — the pre-flight in `byteGateBlocksFetch`, or
       * `measureRegionBytes` ahead of `getFeaturesArray` in canvas's own feature
       * RPC. On the byte axis that is one index read and no features; on canvas's
       * density axis it is the 1kb pre-fetch probe. Adding a second,
       * measurement-only RPC path would have bought nothing and given canvas the
       * two-call coordination it exists to avoid.
       */
      get gateMeasurementStale(): boolean {
        return self.gateMeasuredViewportKey !== self.gateViewport?.key
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The byte budget the gate enforces: the adapter's limit, else the display
       * config, raised by `SUB_FLOOR_BYTE_BUDGET_FACTOR` below the
       * `AUTO_FORCE_LOAD_BP` span. Also what `resolvedByteLimit()` hands the
       * worker, so the two can't gate against different numbers. Force-load
       * doesn't raise this — it exempts the track outright via `gateExempt`.
       *
       * The span tier makes this swing at 20kb, which is safe only because this
       * budget reaches the worker as a call-site argument rather than through
       * `rpcProps()`. In the payload it would be an RPC cache key, and crossing
       * the floor would be a full `clearAllRpcData()` refetch — the bug
       * `maxFeatureDensity` already shipped once. "Neither worker budget may be
       * an RPC cache key", in REGION_TOO_LARGE.md § How the verdict is built.
       *
       * `aboveForceLoadFloor` is also false on an unmeasured view, so read this
       * under `gateActive` or an unmeasured display reads the sub-floor budget
       * rather than no budget. All three consumers do: `resolvedByteLimit()` and
       * `tooLargeStatus` below, and MAF's `framesReadOverBudget`, which bounds a
       * *third* file the banner never quotes (the `mafFrames` overlay) against
       * this same number.
       */
      get gateByteLimit() {
        return resolveByteLimit({
          adapterFetchSizeLimit: self.adapterFetchSizeLimit,
          configFetchSizeLimit: self.configuredFetchSizeLimit,
          belowForceLoadFloor: !self.aboveForceLoadFloor,
        })
      },
      /**
       * #getter
       * Whether the gate may act at this moment, on **any** axis: the display
       * opted in, nothing exempts it, and the view is measured. Every per-axis
       * question is this plus that axis's own terms — today that is nothing at
       * all on the byte side and `densityGateEnabled && aboveForceLoadFloor` on
       * the density one.
       *
       * It was `byteGateActive`, and none of its three terms was ever about
       * bytes; `densityGateActive` was defined as `byteGateActive && …`, which
       * is what that name being wrong looks like from the outside.
       *
       * No span floor on the byte axis. There was one — `AUTO_FORCE_LOAD_BP` —
       * and it rested on "a small span is a small fetch", which the gate now
       * checks rather than assumes: it re-measures at whatever is on screen, so
       * below 20kb the verdict is the same measured comparison it is above. The
       * premise it replaced is false often enough to matter — a 470-way MAF is
       * 6-8MB inside a 40kb window, an amplicon pileup tens of MB — and where it
       * held, the measured estimate is orders of magnitude under
       * `fetchSizeLimit` and no banner appears. Two displays used to opt out of
       * it one at a time (`gateBelowForceLoadFloor`, on MAF and alignments); the
       * opt-in is gone because there is nothing left to opt out of.
       *
       * What the span does below 20kb is raise the *budget*
       * (`SUB_FLOOR_BYTE_BUDGET_FACTOR`, on `gateByteLimit`) rather than switch
       * this off. The difference is that the gate stays reachable at every zoom:
       * index estimates are monotone in span, so an off-switch made the gate
       * bypassable by zooming into it, which is what the floor's own banner told
       * people to do.
       *
       * Everything reads it rather than restating it: the verdict, the
       * pre-flight (no estimate RPC when nothing could act on it), the worker's
       * `resolvedByteLimit()`, and the density axis below.
       */
      get gateActive(): boolean {
        // The view is consulted only past the two cheap terms, so a display that
        // never gates — including a non-LGV consumer of this mixin — never
        // touches `getContainingView`. A measured view is still required: with
        // no viewport there are no regions to measure, so the pre-flight RPC
        // would be issued for nothing.
        return (
          self.gateEnabled &&
          !self.gateExempt &&
          self.gateViewport !== undefined
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the **density** axis may gate at this moment — `gateActive`
       * plus this axis's own two terms: the display opted the axis in, and the
       * span is above the `AUTO_FORCE_LOAD_BP` floor, which is now the floor's
       * only remaining job.
       *
       * `densityGateEnabled` used to live on `CanvasFeatureGateMixin`, out of
       * this getter's reach, so "is the density axis on?" had two spellings and
       * the one consumer that mattered had to ask both
       * (`!densityGateEnabled || !densityGateActive`). Folded in, this getter
       * is the single answer and the budget below it is a plain ternary.
       *
       * The two axes part company because their numbers do. The byte estimate is
       * measured at the span being judged; the density figure is a model — the
       * last fetch's features-per-bp times the current bpPerPx — with nothing
       * measured under it at that span, and it is not monotone in the way the
       * byte axis's argument for dropping the floor relies on (features clump, so
       * a smaller window can hold a *higher* local density than the window that
       * produced the stat). A scan of every indexed file in this repo
       * (2026-08-06) found the density gate would trip below 20kb on exactly two,
       * both cohort copy-number BEDs whose feature count doesn't fall with span
       * at all — and both are `LinearMultiRowFeatureDisplay` tracks, which turn
       * this axis off. So the floor here costs nothing measurable and removing it
       * would buy nothing measurable.
       *
       * `CanvasFeatureGateMixin` reads this for its `maxFeatureDensity` budget.
       */
      get densityGateActive(): boolean {
        return (
          self.gateActive && self.densityGateEnabled && self.aboveForceLoadFloor
        )
      },
      /**
       * #method
       * The byte budget a fetch RPC enforces worker-side, short-circuiting an
       * over-budget region before it downloads any features. Undefined
       * (unlimited) when the gate is off; otherwise the very number the banner
       * compares against, so the worker can't reject a region the banner then
       * calls fine. Lives here, not on the canvas gate that consumes it, because
       * both its terms are this mixin's — canvas owns only how the density
       * number is measured.
       */
      resolvedByteLimit(): number | undefined {
        return self.gateActive ? self.gateByteLimit : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The verdict the whole mixin exists to produce, with the banner text: true
       * when the measured download for what is on screen exceeds the resolved
       * byte budget, or when the display's own density axis trips (bytes take
       * precedence for the text). Each axis is passed as `undefined` / `false`
       * when its own `…GateActive` is off, which is what keeps every "may this
       * axis gate" term — the opt-ins, force-load, the density floor — stated in
       * those two getters and nowhere else.
       *
       * The fetch autoruns re-measure rather than fetch while `regionTooLarge` is
       * true, and `DisplayChrome` renders the banner from `regionTooLargeReason`.
       */
      get tooLargeStatus() {
        // Both byte terms hang off the one flag, and the budget must too: a
        // display that never gates has no containing track to read
        // `adapterFetchSizeLimit` off in the first place. "Nothing below the
        // opt-in is evaluated" is a property the ungated composers (wiggle,
        // Manhattan, sequence) and the simplified test models rely on.
        const active = self.gateActive
        return evaluateRegionTooLarge({
          estimatedFetchBytes: active ? self.estimatedFetchBytes : undefined,
          byteLimit: active ? self.gateByteLimit : undefined,
          densityTooLarge: self.densityGateActive && self.densityTooLarge,
        })
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

      /**
       * #getter
       * Whether "zoom in to see features" is still honest advice — the banner
       * offers that way out only when this is true, and force-load alone when it
       * isn't.
       *
       * **Asked of the axis that actually tripped**, because only one of the two
       * can ever answer no. Screen density is features ÷ pixels, so it falls
       * with `bpPerPx` by construction and zooming always releases it. Bytes
       * don't work that way: an index quotes whole blocks, so whether zooming
       * shrinks a given file's fetch is a property of that file's blocks and not
       * of any span threshold, and `ByteEstimate.zoomIneffective` records that
       * the user zoomed in materially and the bytes did not move.
       *
       * Reading `zoomIneffective` alone gets the density case backwards on
       * exactly the files that axis exists for. A dense VCF is small on disk and
       * flat across zooms, so two zoom steps while density-blocked set the flag
       * — the worker reports `bytes` alongside a density rejection, so the
       * estimate keeps updating while the banner holds — and the banner would
       * then withhold the one way out that works.
       *
       * True until proven otherwise, so a track that has been measured once
       * still reads as escapable. That is the right default: the failure this
       * guards is telling someone to keep zooming forever, not withholding the
       * suggestion for one zoom step.
       */
      get zoomCanReleaseGate(): boolean {
        return (
          self.tooLargeStatus.axis !== 'bytes' ||
          !self.byteEstimate?.zoomIneffective
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Commits a byte measurement together with the viewport it describes.
       * `viewport` must be `gateViewport` read when the measurement was
       * *requested*, not at commit time — a view that moved during the round trip
       * would otherwise label the number with a viewport it never covered, and
       * both readers of that label (`gateMeasurementStale`, `zoomIneffective`) would
       * answer about the wrong one. Harmless for non-gated displays (they ignore
       * it).
       *
       * Goes through `nextByteEstimate` rather than storing the argument,
       * because one thing about a measurement is only knowable from the one
       * before it: whether zooming in moved the number at all. See
       * `ByteEstimate.zoomIneffective`.
       *
       * `bytes` is a number, never `undefined`: a fetch that measured nothing
       * calls this not at all, so the stored estimate stays whatever the last
       * real measurement said. Both callers already skip that write —
       * `byteGateBlocksFetch` and `commitGateMeasurements` — and the type is
       * what keeps a third from publishing an empty one.
       */
      setByteEstimate(measurement: { bytes: number; viewport: GateViewport }) {
        self.byteEstimate = nextByteEstimate(self.byteEstimate, measurement)
      },

      /**
       * #action
       * Record that the gate has asked the adapter about this viewport, whatever
       * it learned. Every gated fetch calls it — the pre-flight below, and
       * canvas's `commitGateMeasurements` — and it is deliberately **separate**
       * from `setByteEstimate`, because a fetch can come back having measured
       * density and no bytes (a dense region short-circuits on the feature count,
       * and an unmeasurable byte result must not overwrite a good estimate). Both
       * still asked, and `gateMeasurementStale` is the question "did we ask about
       * what is on screen now", not "do we have bytes for it".
       */
      setGateMeasuredViewport(viewport: GateViewport) {
        self.gateMeasuredViewportKey = viewport.key
      },

      /**
       * #action
       * Drops the cached estimate. Two callers, and they are the same rule on
       * two axes — the estimate describes one fetch, and each of them changes
       * which fetch that is: chromosome navigation (`MultiRegionDisplayMixin`'s
       * `DisplayedRegionsChange` autorun; LD and arc wire their own), and a tier
       * swap (`ClearByteEstimateOnTierSwap`, this mixin's own `afterAttach`).
       * Not an ordinary viewport change: the estimate intentionally survives
       * `clearAllRpcData` so panning doesn't flicker the banner.
       *
       * `forceLoadTrack` deliberately survives both: it is a track-wide
       * approval, so expiring it here is exactly the per-locus re-approval the
       * button exists to avoid.
       */
      clearByteEstimate() {
        self.byteEstimate = undefined
        self.gateMeasuredViewportKey = undefined
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
       * the estimate with the viewport it describes, and answer whether the
       * caller must abandon the fetch — either superseded mid-measure, or over
       * budget.
       *
       * Every pre-flight caller (`fetchRegions` for the MultiRegionDisplayMixin
       * family, LD and arc from their own global fetches) calls this and returns
       * on true. It short-circuits to false when `measuresBytesPreFlight` is off,
       * so the call is unconditional at every site — canvas leaves it off and
       * measures inside its own feature RPC instead.
       *
       * Sequencing the steps at a call site is what used to go wrong: the
       * viewport is read here, *before* the await, so the estimate is labelled
       * with the one it actually covers. A re-read afterwards would pin it to
       * whatever a mid-fetch zoom left on screen, and both things the label is
       * for — `gateMeasurementStale`, `zoomIneffective` — would then answer about a
       * viewport the number was never taken at.
       */
      async byteGateBlocksFetch(
        regions: {
          refName: string
          start: number
          end: number
          assemblyName: string
        }[],
        // the whole FetchContext, not just its `isStale`: this measurement
        // downloads index chunks on every viewport change for BAM/CRAM/tabix,
        // so it is exactly as worth cancelling as the fetch it precedes — and
        // it is the first thing the user waits on when a track opens wide, so
        // it is worth naming on the status channel too. Narrowing the parameter
        // to `isStale` left both on the floor at every call site.
        ctx: FetchContext,
      ) {
        const viewport = self.gateViewport
        // `viewport` is `gateActive`'s own third term, restated only because
        // TypeScript needs the narrowing to hand it to the two commits below.
        if (!self.measuresBytesPreFlight || !viewport || !self.gateActive) {
          return false
        }
        const bytes = await updateStatus(
          'Estimating size',
          ctx.statusCallback,
          () =>
            getSession(self).rpcManager.call(
              getRpcSessionId(self),
              'CoreGetRegionByteEstimate',
              {
                regions,
                adapterConfig: self.byteGateAdapterConfig,
                // This budget is enforced once per region — `gateByteLimit` is
                // what a single region may cost — so the region set reduces by
                // max, exactly as `commitGateMeasurements` reduces canvas's
                // per-region fetches. It read the merged total until 2026-08,
                // which is a budget on the whole download, and that is how the
                // same VCF came to banner under this path and render under
                // canvas's.
                scope: 'largestRegion',
                stopToken: ctx.stopToken,
                statusCallback: ctx.statusCallback,
              },
            ),
          // makes the phase a cancellation boundary as well as a label: a fetch
          // superseded before the measure starts skips the RPC outright, and
          // `runFetch` swallows the abort as the ordinary end of a stale fetch
          ctx.stopToken,
        )
        if (ctx.isStale()) {
          return true
        }
        self.setGateMeasuredViewport(viewport)
        // An adapter that quotes no index estimate answers `undefined`, and that
        // is not a measurement: publishing it would wipe the last real one and
        // reset the two-point `zoomIneffective` comparison. The stamp above
        // still records that the gate asked about this viewport, which is what
        // `gateMeasurementStale` means. `commitGateMeasurements` skips the same
        // write for the same reason — the two paths agree.
        if (bytes !== undefined) {
          self.setByteEstimate({ bytes, viewport })
        }
        // Read after the commit: the verdict is a pure function of the estimate,
        // and the estimate was just taken at this viewport.
        return self.regionTooLarge
      },
    }))
    .actions(self => ({
      // The fork auto-chains afterAttach, so this runs alongside the composing
      // display's own without either calling super.
      afterAttach() {
        reportRenamedHooks(self)

        // Drop the cached estimate when the tier it measured stops being the
        // tier we would fetch. `clearByteEstimate` on chromosome nav already
        // handles "these bytes are about a different region"; this is the same
        // rule on the other axis, "these bytes are about a different file", and
        // it wedges the same way if skipped: MAF captures a 470-way detail
        // estimate below 20kb, zooms out into the cheap summary tier, and the
        // detail number — megabytes — banners a summary read that would have
        // measured ~60 kB. The while-gated re-measure would correct it a beat
        // later, but only after the banner had already quoted the wrong number
        // against the wrong file, and only if the viewport kept moving.
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
              // ungated composers (wiggle, Manhattan, sequence) rely on.
              if (!self.gateEnabled) {
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
