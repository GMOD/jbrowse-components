import {
  assertDisplayContract,
  makeRetryContractCheck,
  noteFetchFunnelEntered,
  takeFetchFunnelEntered,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import {
  createStatusFanOut,
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getTrackAssemblyNames } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { regionDataMap } from '@jbrowse/render-core/installPerRegionLifecycle'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { autorun, untracked } from 'mobx'

import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.ts'
import FetchMixin from './FetchMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import { installClearHoverOnViewportChange } from './installClearHoverOnViewportChange.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { FetchContext } from './FetchMixin.ts'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
import type { IAutorunOptions } from 'mobx'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

export type { FetchContext } from './FetchMixin.ts'

/**
 * True when the loaded region fully contains the visible `block`: same refName
 * and the integer-rounded block bounds lie within the loaded extent.
 * `Math.floor`/`Math.ceil` handle fractional bpPerPx where block edges fall on
 * non-integer genomic positions. Single source of truth for "is this block
 * already fetched" — shared by the FetchVisibleRegions autorun (deciding what to
 * refetch) and the `viewportWithinLoadedData` getter (deciding whether the on-screen data
 * is stale).
 */
export function isBlockCovered(
  loaded: Region | undefined,
  block: { refName: string; start: number; end: number },
) {
  return (
    loaded?.refName === block.refName &&
    Math.floor(block.start) >= loaded.start &&
    Math.ceil(block.end) <= loaded.end
  )
}

/**
 * #stateModel MultiRegionDisplayMixin
 * #displayFoundationDef Per-region fetch + render: the fetch autoruns, `rpcProps()` refetch wiring, and byte gating. The common case.
 * #category display
 *
 * Per-region fetch lifecycle for LGV-based GPU displays. Installs the fetch
 * autoruns in `afterAttach` and exposes overridable hooks (`fetchNeeded`,
 * `rpcProps`, `isCacheValid`, `measuresBytesPreFlight`) plus the `fetchRegions`
 * / `loadedRegions` machinery.
 */
export default function MultiRegionDisplayMixin() {
  return (
    types
      .compose(
        'MultiRegionDisplayMixin',
        RegionTooLargeMixin(),
        RenderLifecycleMixin(),
        FetchMixin(),
        types.model({}),
      )
      .volatile(() => ({
        /**
         * #volatile
         * regions whose data has been fetched and committed, keyed by
         * displayedRegionIndex; populated only after the fetch work callback
         * returns
         */
        loadedRegions: regionDataMap<Region>(),
        /**
         * #volatile
         * Bumped by `reload()` and read unconditionally by the fetch autorun,
         * so a user retry re-runs the body even where nothing else moved. The
         * base `reload()` also clears `loadedRegions`, which is what normally
         * re-fires it — the counter is the half that survives a `reload()`
         * override that forgets to invalidate, which is the dead button
         * `makeRetryContractCheck` reports. Same name and same role as
         * `GlobalFetchMixin`'s, so the two families read alike.
         */
        reloadCounter: 0,
      }))
      .views(self => ({
        /**
         * #getter
         * The containing LinearGenomeView, typed once for every display in this
         * family so no consumer repeats the `getContainingView` cast — the cast
         * `getContainingView` needs (it is view-type-agnostic) but which this
         * mixin has already committed to, since everything below reads
         * `visibleRegions` / `bufferedVisibleRegions` / `bpPerPx` off it.
         *
         * Three displays had each invented this getter under two names before it
         * was hoisted (`view` on HiC and Manhattan, `lgv` on MAF) while ~35 other
         * sites repeated the cast inline. `lgv` rather than `view` because a
         * display's containing view is not always an LGV — the comparative
         * displays' `view` is a synteny or dotplot view — so the name says which
         * one this is.
         *
         * Components and structural helpers keep calling `getContainingView`:
         * they take duck-typed model shapes that deliberately don't carry the
         * whole MST instance type, so there is no `lgv` on them to read.
         */
        get lgv(): LinearGenomeViewModel {
          return getContainingView(self) as LinearGenomeViewModel
        },

        /**
         * #getter
         * The CSS width of this display's on-screen canvas, in px — and the
         * `canvasWidth` its `renderState` must carry, since the two have to
         * agree or the bp→px mapping is scaled against a box it doesn't fill.
         *
         * `trackWidthPx`, **not** `view.width`: `TrackRenderingContainer` insets
         * the rendering component by the 2px track outline under
         * `contain: strict`, so a `view.width`-wide canvas overhangs its own
         * container and the browser clips the overhang away. It renders almost
         * identically, which is why MAF drifted onto `view.width` uncaught.
         *
         * A getter rather than a note on each display, because the choice was
         * being made by copying a neighbour out of four plausible view getters —
         * `width` (the viewport), this one, and `totalWidthPx` /
         * `totalWidthPxWithoutBorders` (the *content* width, which the global
         * family's heatmaps legitimately want: a different question, not a
         * different answer). `no-restricted-syntax` bans the underlying read
         * everywhere but this line, since a second spelling agrees until it
         * doesn't.
         *
         * SVG export is the one exception: the export shell has no outline, so
         * `renderSvg` overrides `canvasWidth` with the shell's own width (see
         * `LgvSvgBodyProps`).
         */
        get canvasWidthPx(): number {
          return this.lgv.trackWidthPx
        },

        /**
         * #getter
         * The render-lifecycle precondition for every LGV display (overrides
         * `RenderLifecycleMixin`'s default-true hook): don't run the upload/render
         * callbacks until the view is measured. Before that, `renderBlocks` →
         * `visibleRegions` → `view.width` throws by design, and the render
         * autorun's catch would show that as a GPU render-error banner. Gating here
         * — once, for all of them — is what lets a display's `renderState` be a
         * plain resolved getter and its render callback gate only on its own data.
         * The render-lifecycle twin of `autorunOnReadyView`.
         */
        get canRender() {
          return this.lgv.initialized
        },

        /**
         * #getter
         * true when every visible block lies within an already-fetched region —
         * i.e. the viewport shows data we actually loaded, not the stale fringe
         * left after a zoom-out/pan. Drives the loading overlay through the
         * pre-refetch debounce. Spatial only; see CLAUDE.md for why this is exact
         * and for the resolution-staleness gap.
         */
        get viewportWithinLoadedData() {
          const view = this.lgv
          return view.initialized
            ? view.visibleRegions.every(block =>
                isBlockCovered(
                  self.loadedRegions.get(block.displayedRegionIndex),
                  block,
                ),
              )
            : false
        },

        /**
         * #getter
         * Overridable hook (default false): a subclass returns true to mark an
         * extra terminal state where off-screen export can proceed with no loaded
         * data. Sequence sets it when zoomed past base resolution — it renders a
         * static "zoom in" message and fetches nothing, so `svgReady` would
         * otherwise never resolve.
         */
        get svgReadyExtraTerminal(): boolean {
          return false
        },

        /**
         * #getter
         * Fills `RenderLifecycleMixin`'s `paintInert` hook — see there for why a
         * failed fetch has to read as finished to the consumers outside the
         * display. The global family declares the identical override.
         */
        get paintInert(): boolean {
          return !!self.error
        },

        /**
         * #getter
         * Overridable hook (default false): whether a searchable feature layout
         * currently exists. Any display defining a feature-lookup method
         * (`searchFeatureByID`, `getFeatureById`) must override it, so callers can
         * tell "laid out, but off-display" from "no layout exists yet" — a
         * distinction only the display can make. See
         * plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md §"Four
         * readiness axes".
         */
        get layoutReady(): boolean {
          // fail-safe: forgetting the override drops overlays (visibly absent)
          // rather than pinning them to one edge (a plausible lie)
          return false
        },

        /**
         * #getter
         * Shared cached view for every LGV-based GPU display. A single
         * displayedRegion may produce multiple render blocks (shared GPU
         * buffer, different scissor clips on screen). Plugins that want to
         * suppress rendering in certain states (e.g. no domain yet) can
         * override this getter to return [] — the autorun lifecycle will
         * then issue an empty-blocks render that clears the canvas.
         */
        get renderBlocks() {
          return buildRenderBlocks(this.lgv.visibleRegions)
        },
      }))
      // `dataCurrent` and `svgReady` sit in their own blocks, after everything
      // they read, so each reads its siblings off `self` rather than `this`.
      // Same shape as `GlobalFetchMixin`, and for the reason in CLAUDE.md ("a
      // super-captured view is called bare"): a subclass that captures one of
      // these and calls it with no receiver would get `undefined` for a `this`
      // sibling. Nothing captures them today; the split is what keeps that true
      // by construction instead of by luck.
      .views(self => ({
        /**
         * #getter
         * This family's answer to the shared freshness question every display
         * foundation must answer (`dataCurrent`): the held data corresponds to
         * what is on screen right now. Here that is spatial — every visible block
         * lies within a fetched region — plus `loadedRegions.size`, which rules
         * out the vacuously-true empty viewport. Regions stream in one at a time,
         * so this (not "the first datum arrived") is what keeps a
         * multi-region/whole-genome export complete.
         *
         * Distinct from `viewportWithinLoadedData`, which is the raw coverage
         * predicate the fetch autorun and the loading overlay use.
         */
        get dataCurrent(): boolean {
          return self.viewportWithinLoadedData && self.loadedRegions.size > 0
        },
      }))
      .views(self => ({
        /**
         * #getter
         * true once an off-screen (SVG) export can safely read this display's
         * data. Policy single-sourced in `computeSvgReady`; this family supplies
         * only its `dataCurrent` predicate. Off-screen renderers gate on it via
         * `awaitSvgReady(model)` instead of inlining the condition.
         */
        get svgReady(): boolean {
          return foundationSvgReady(self)
        },

        /**
         * #getter
         * The display's mutually-exclusive visual state, mapped in
         * `foundationDisplayPhase` — every foundation calls it and supplies only
         * its staleness argument, so a term added to `computeLoadingTerm`
         * reaches all three without being wired three times.
         *
         * This family's argument is spatial: `loading` also covers stale data
         * (viewport past loaded) still on screen through the pre-refetch
         * debounce. A thunk, so a suppressed or already-loading display doesn't
         * subscribe to viewport churn.
         *
         * A subclass customizes this through `loadingSuppressed` (FetchMixin),
         * never by overriding the getter — see that hook.
         */
        get displayPhase(): DisplayPhase {
          return foundationDisplayPhase(
            self,
            () => self.viewportWithinLoadedData,
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Action wrapper so callers after async boundaries stay in MST strict
         * mode.
         */
        setLoadedRegion(displayedRegionIndex: number, region: Region) {
          self.loadedRegions.set(displayedRegionIndex, region)
        },

        /**
         * #action
         * no-op base — subclasses override to clear rpcDataMap etc.
         */
        clearDisplaySpecificData() {},
      }))
      .actions(self => ({
        /**
         * #action
         * full reset: cancels fetch, clears error, loadedRegions,
         * display-specific data, and the canvas-drawn flag. The too-large gate is
         * derived (a pure function of the cached estimate × viewport), so it needs
         * no explicit clear here — the fetch autorun re-measures at the new
         * viewport and the verdict follows.
         */
        clearAllRpcData() {
          self.cancelFetch()
          self.setError(undefined)
          self.loadedRegions.clear()
          self.clearDisplaySpecificData()
          self.resetCanvasDrawn()
        },

        /**
         * #action
         * Default reload: full reset. Subclasses with extra teardown can
         * override (and chain to `clearAllRpcData` directly if needed).
         *
         * An override must reach this counter, by chaining to super or by
         * bumping it — `MultiSampleVariantBaseModel` is the one that overrides
         * today and chains. Missing it doesn't break the retry, which the
         * `clearAllRpcData` call drives; it turns the dev-only retry check off
         * for that display, silently, which is the failure mode worth knowing.
         */
        reload() {
          self.reloadCounter++
          this.clearAllRpcData()
        },
      }))
      .actions(_self => ({
        /**
         * #action
         * Overridable hook (no-op base): override to call
         * `this.fetchRegions(needed, async ctx => { ... })`.
         */
        fetchNeeded(
          _needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          // no-op base
        },
      }))
      // A pure read of view/display state, read from the `FetchVisibleRegions`
      // autorun. It is a **view, not an action**, deliberately: MobX runs an
      // action inside `untracked`, so as an action its `view.bpPerPx` read
      // registered no dependency and the caller silently kept a stale answer.
      // That worked only by accident — the autorun happened to read
      // `view.visibleRegions`, which moves in lockstep — which made "don't let
      // this be your only dependency" an unwritten precondition on every
      // override. Overrides must stay views for the same reason.
      .views(() => ({
        /**
         * #method
         * Overridable hook: return `false` to force re-fetch at the current
         * zoom (wiggle uses this for zoom-level changes).
         */
        isCacheValid(_displayedRegionIndex: number): boolean {
          return true
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Run a per-region fetch with byte-estimate gating. Marks regions as
         * loaded only AFTER the work callback has populated display-specific
         * data (rpcDataMap, cellData, etc) so the GPU upload autorun sees
         * committed data when it observes loadedRegions.
         */
        async fetchRegions(
          needed: { region: Region; displayedRegionIndex: number }[],
          work: (ctx: FetchContext) => Promise<void>,
        ) {
          // The retry check's only view of this family's gate — see there for
          // why the funnel and not `fetchNeeded`'s return value.
          noteFetchFunnelEntered(self)
          await self.runFetch(async ctx => {
            // No-op unless the display set `measuresBytesPreFlight` — see
            // RegionTooLargeMixin
            if (
              await self.byteGateBlocksFetch(
                needed.map(r => r.region),
                ctx,
              )
            ) {
              return
            }
            await work(ctx)
            if (!ctx.isStale()) {
              for (const { displayedRegionIndex, region } of needed) {
                self.setLoadedRegion(displayedRegionIndex, region)
              }
            }
          })
        },
      }))
      .actions(self => ({
        /**
         * #action
         * installs the fetch-lifecycle autoruns (DisplayedRegionsChange,
         * FetchVisibleRegions, SettingsInvalidate,
         * ClearBlockingStateOnViewportChange)
         */
        afterAttach() {
          // Dev-only: the contracts no type expresses (this hook not being
          // chained to super, `isCacheValid`/`rpcProps` being views). Runs
          // before anything is installed so a double-install is reported rather
          // than merely happening.
          assertDisplayContract(self)

          // The other half of the same doctrine: the trigger reads below
          // guarantee `reload()` re-RUNS the fetch autorun, not that the run
          // reaches a fetch. The global family has had this since arc shipped a
          // dead Retry; this family is three times the size and had nothing.
          const noteFetchAutorunRun = makeRetryContractCheck(self)

          // Clear loaded data whenever the displayed-regions list changes,
          // through the same `onDisplayedRegionsChange` helper the two displays
          // outside this family (LD, arc) use — one spelling of the trigger, so
          // this family's clear can't come to mean something different from
          // theirs. Fires once at mount as a harmless no-op (nothing loaded
          // yet).
          //
          // The cached byte estimate goes with it. displayedRegionIndex is
          // reused across chromosomes, so a stale estimate describes the
          // previous chromosome's numbers, and the banner would quote them at
          // the new region for the settled cycle it takes to re-measure. Only
          // that long — the new region moves `gateViewport.key`, so
          // `gateMeasurementStale` lets the fetch through and the next
          // measurement corrects it. clearAllRpcData deliberately leaves the
          // estimate alone (no banner flicker on an ordinary viewport-change
          // clear), which is why the drop lives in this autorun rather than in
          // that action.
          //
          // One of two drops, not the only one: RegionTooLargeMixin's own
          // ClearByteEstimateOnTierSwap does the same when a display that swaps
          // adapters by zoom crosses tiers. Same rule on the other axis — the
          // estimate is about a fetch, and both change which fetch that is.
          //
          // #autorun `view.displayedRegions` changes | `clearAllRpcData()` **+ `clearByteEstimate()`** — one of the two places the cached byte estimate is dropped (the other is a tier swap)
          onDisplayedRegionsChange(
            self,
            () => {
              self.clearAllRpcData()
              self.clearByteEstimate()
            },
            'DisplayedRegionsChange',
          )

          // Autorun: fetch data when the visible viewport isn't covered
          // by loaded data. Fetches with an explicit buffer for smooth
          // scrolling without blank gaps.
          //
          // #autorun the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized
          autorunOnReadyView(
            self,
            view => {
              void self.fetchGeneration
              // Unconditional and above every gate, for the reason the global
              // family's identical read exists: `reload()` normally re-fires
              // this through `clearAllRpcData`'s `fetchGeneration` bump, but an
              // override that clears nothing would then not re-run the body at
              // all — and a dead button nobody re-runs is one the check below
              // never gets a run to judge.
              void self.reloadCounter
              if (self.error || self.fetchCanceled) {
                // A visible terminal state answers the retry: the user is
                // looking at an error bar or a canceled load, not at a button
                // that did nothing.
                noteFetchAutorunRun('gated')
                return
              }
              // A blocked gate skips the fetch it has already measured, not
              // every fetch. Letting it run unconditionally would spin — a
              // too-large region stores nothing, so it stays in `needed`, and
              // the `fetchGeneration` bump after each attempt re-fires this
              // body. Skipping unconditionally is what used to freeze the
              // estimate at the viewport it was captured over, leaving the
              // banner to be released by arithmetic instead
              // (RegionTooLargeMixin §"Measurement follows the viewport").
              //
              // So the fetch runs once per settled viewport while blocked, and
              // it stops at whichever gate rejected it: an index read and no
              // features on the byte axis, canvas's 1kb density probe on the
              // other. `gateSkipsMeasuredViewport` is `RegionTooLargeMixin`'s,
              // and the global foundation's skip is the same getter — one
              // spelling, because a guard kept in two copies is where an escape
              // clause gets added to one of them.
              if (self.gateSkipsMeasuredViewport) {
                // The banner here offers Force load, not Retry, so this run
                // answers the bump legitimately.
                noteFetchAutorunRun('gated')
                return
              }

              // perf guard: isLoading flip would re-fire this autorun mid-fetch;
              // fetchGeneration (bumped after fetch) is the real re-trigger.
              if (untracked(() => self.isLoading)) {
                // Deferred, not consumed. `reload()` signals the running fetch's
                // stop token but `activeStopToken` clears in `runFetch`'s
                // finally, so the run immediately after a retry can still land
                // here — and that fetch ending bumps `fetchGeneration`, which
                // re-runs this body. Consuming would answer the retry with a run
                // that predates it.
                noteFetchAutorunRun('deferred')
                return
              }

              const { assemblyManager } = getSession(self)
              const track = getContainingTrack(self)
              // Skip fetching while the track is minimized (hidden). `minimized`
              // is exactly what the display's `isMinimized` getter resolves to,
              // and it's a tracked observable, so un-minimizing re-fires this
              // autorun and the fetch resumes. Reuses the track already resolved
              // for the assembly-name check below — no extra getContainingTrack.
              if (track.minimized) {
                // Nothing is on screen to click, so there is no dead button to
                // report; un-minimizing re-fires this and the retry is judged
                // then, off whatever bump is still outstanding.
                noteFetchAutorunRun('gated')
                return
              }
              const trackAssemblyNames = getTrackAssemblyNames(track)
              const visibleRegions = view.visibleRegions
              for (const block of visibleRegions) {
                const regionAsm = block.assemblyName
                if (
                  !trackAssemblyNames.includes(regionAsm) &&
                  !trackAssemblyNames.some(name =>
                    assemblyManager.get(name)?.hasName(regionAsm),
                  )
                ) {
                  self.setError(
                    new Error(
                      `region assembly (${regionAsm}) does not match track assemblies (${trackAssemblyNames})`,
                    ),
                  )
                  // Raising a new error is an answer, and a visible one.
                  noteFetchAutorunRun('gated')
                  return
                }
              }

              const bufferedByIndex = new Map(
                view.bufferedVisibleRegions.map(b => [
                  b.displayedRegionIndex,
                  b,
                ]),
              )
              const needed: {
                region: Region
                displayedRegionIndex: number
              }[] = []
              for (const block of visibleRegions) {
                // perf guard: loadedRegions population would re-fire this autorun;
                // fetchGeneration bump after setLoadedRegion is the real signal.
                const loaded = untracked(() =>
                  self.loadedRegions.get(block.displayedRegionIndex),
                )
                // `&&` short-circuits, so on a run where the block is NOT
                // covered `isCacheValid`'s observables go untracked — the same
                // shape as the gated-trigger hazard in
                // `installGlobalFetchAutorun`. It is safe here for a reason
                // worth stating rather than rediscovering: an uncovered block
                // always reaches `fetchNeeded` below, and every way that can
                // end re-wakes this autorun through something it already
                // tracks — a fetch bumps `fetchGeneration`, and the two
                // displays whose `fetchNeeded` can decline (sequence on
                // `zoomedOut`, variants before `sourcesBase` arrives) are woken
                // by `view.visibleRegions` and by `SettingsInvalidate`
                // respectively. A new early return in a `fetchNeeded` override
                // has to satisfy that or the display wedges: see CLAUDE.md,
                // "`isCacheValid` and `rpcProps` are views, not actions".
                //
                // The retry check below now watches half of that rather than
                // leaving it to this comment: a decline following a `reload()`
                // reports unless the display says `loadingSuppressed` (sequence,
                // whose `zoomedOut` implies it) or `awaitingPrerequisite`
                // (variants, until `sourcesBase` lands).
                if (
                  isBlockCovered(loaded, block) &&
                  self.isCacheValid(block.displayedRegionIndex)
                ) {
                  continue
                }
                const buffered = bufferedByIndex.get(block.displayedRegionIndex)
                if (buffered) {
                  needed.push(buffered)
                }
              }
              if (needed.length === 0) {
                // Every visible block is already covered, so this run reached
                // no fetch. Following a `reload()` that is the dead button: the
                // base clears `loadedRegions`, so an override landing here
                // invalidated nothing.
                noteFetchAutorunRun('declined')
                return
              }
              // Cleared first so the read below can only see this call's entry.
              takeFetchFunnelEntered(self)
              // Not awaited — and the classification depends on that. The
              // override's synchronous prefix has run by the time it hands back
              // a promise, and reaching `fetchRegions` is what every one of them
              // does there.
              self.fetchNeeded(needed)
              noteFetchAutorunRun(
                takeFetchFunnelEntered(self) ? 'fetched' : 'declined',
              )
            },
            {
              name: 'FetchVisibleRegions',
              delay: 600,
            },
          )

          // Re-fetch when the RPC payload changes. The cache key is what
          // rpcProps() *returns*, not what building it reads — see the
          // `rpcPropsCacheKey` getter.
          //
          // #autorun `rpcPropsCacheKey`, the serialized `rpcProps()` return | `clearAllRpcData()`. Installed only when the display defines `rpcProps()`
          if ((self as { rpcProps?: () => unknown }).rpcProps) {
            const loopGuard = makeSettingsLoopGuard('SettingsInvalidate')
            autorunOnReadyView(
              self,
              () => {
                void self.rpcPropsCacheKey
                loopGuard()
                self.clearAllRpcData()
              },
              { name: 'SettingsInvalidate' },
            )
          }

          // When zoom or viewport position changes while an error or a canceled
          // fetch is set, clear so the fetch autorun retries. (The too-large gate
          // is derived — a pure function of the last measurement — so it clears
          // on the next one and
          // needs no clear here; only the terminal error/cancel states, which are
          // imperative flags, do.) Reads them untracked so setting them doesn't
          // trigger this autorun to immediately wipe them — only the viewport read
          // should fire it.
          //
          // #autorun `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself
          autorunOnReadyView(
            self,
            view => {
              void view.visibleRegions
              if (untracked(() => self.fetchCanceled || self.error)) {
                self.clearAllRpcData()
              }
            },
            { name: 'ClearBlockingStateOnViewportChange' },
          )

          // Drop a stored hover whenever the content it names moves or goes
          // away. Installed here rather than per display because the six
          // displays that store one all reach it through this foundation, and
          // the failure mode is omission: a seventh that forgets keeps naming
          // what USED to be under the cursor, with no error anywhere. Clears
          // through `BaseDisplay.clearHoveredFeature`, whose default is a
          // no-op, so a display deriving its hover pays nothing.
          //
          // Cast because `clearHoveredFeature` is `BaseDisplay`'s and this mixin
          // does not compose it — the same shape as `WiggleScoreConfigMixin`'s
          // `confNode(self)`, and the cast names exactly what is read.
          addDisposer(
            self,
            installClearHoverOnViewportChange(
              self as typeof self & { clearHoveredFeature: () => void },
            ),
          )
        },
      }))
  )
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>

// Install an autorun on a display whose body only runs once the containing
// LGV is initialized (measured width + ready assemblies). Centralizes the
// `if (!view.initialized) return` guard every LGV-display autorun needs:
// before init, view-derived getters like `view.width` throw by design, so a
// body that reads them must not run yet. `initialized` is observable, so the
// body re-runs automatically the moment the view becomes ready. The view is
// passed in so callers don't re-fetch it.
export function autorunOnReadyView(
  self: IAnyStateTreeNode,
  fn: (view: LinearGenomeViewModel) => void,
  opts?: IAutorunOptions,
) {
  addDisposer(
    self,
    autorun(() => {
      const view = getContainingView(self) as LinearGenomeViewModel
      if (view.initialized) {
        fn(view)
      }
    }, opts),
  )
}

/**
 * Dev-only feedback-loop guard for the (undelayed) `SettingsInvalidate` autorun.
 * The classic `rpcProps()` trap (ARCHITECTURE.md §"rpcProps() loop trap") puts a
 * fetch-derived value in `rpcProps()`, so the autorun that reads it and clears
 * fetched data re-invalidates itself — MobX runs it until its 100-iteration
 * convergence guard throws a cryptic "Reaction doesn't converge". Call this at
 * the top of the body's mutating section: it throws a message naming the actual
 * cause the first time the body re-fires far more times in one synchronous tick
 * than any real settings change could, and — because it throws *before* the
 * `clearAllRpcData()` that perpetuates the cycle — that iteration's invalidating
 * mutation never runs, breaking the loop. No-op in production. (The debounced
 * `installGlobalFetchAutorun` variant loops on the async-fetch cadence, not
 * synchronously, so this within-tick counter does not catch it — that hazard is
 * documented at the call site instead.)
 */
export function makeSettingsLoopGuard(name: string): () => void {
  if (process.env.NODE_ENV === 'production') {
    return () => {}
  }
  let firesThisTick = 0
  let resetScheduled = false
  return () => {
    firesThisTick += 1
    if (!resetScheduled) {
      resetScheduled = true
      // Runs once the synchronous tick unwinds; a runaway loop never yields to
      // it, so the counter keeps climbing until the throw below.
      queueMicrotask(() => {
        firesThisTick = 0
        resetScheduled = false
      })
    }
    if (firesThisTick > 50) {
      throw new Error(
        `${name} re-fired >50× in one synchronous tick — a fetch-derived value ` +
          `is almost certainly in rpcProps(), so invalidating the fetch changes ` +
          `rpcProps() and re-invalidates it. See ARCHITECTURE.md "rpcProps() ` +
          `loop trap": rpcProps() must read only user-controlled settings.`,
      )
    }
  }
}

interface FetchEachRegionModel {
  fetchRegions: (
    needed: { region: Region; displayedRegionIndex: number }[],
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
}

/**
 * The per-region fan-out on its own, without the `fetchRegions` wrapper: issue
 * `call` for every needed region in parallel and return the results paired with
 * their `displayedRegionIndex`, in `needed` order. Callers get one collected
 * array to commit from, which is what a cross-region decision needs (MAF picks
 * the sample set from whichever region actually discovered samples).
 *
 * Use this only inside a `fetchRegions` work callback you already own — it does
 * no staleness checking of its own, because the *caller* decides the
 * granularity: {@link fetchEachRegion} guards per region so an early result
 * still commits, while a display that commits atomically guards once around the
 * whole batch. Prefer `fetchEachRegion` unless you need the collected array or
 * a concurrent side-fetch under the same stop token.
 */
export function callEachRegion<R>(
  needed: { region: Region; displayedRegionIndex: number }[],
  ctx: FetchContext,
  call: (
    region: Region,
    ctx: FetchContext,
    displayedRegionIndex: number,
  ) => Promise<R>,
): Promise<{ displayedRegionIndex: number; result: R }[]> {
  const perRegion = fanOutStatus(ctx, needed.length)
  return Promise.all(
    needed.map(async ({ region, displayedRegionIndex }, i) => ({
      displayedRegionIndex,
      result: await call(region, perRegion[i]!, displayedRegionIndex),
    })),
  )
}

/**
 * One context per concurrent region, each carrying its own status slot, so the
 * N of them aggregate into a single Σcurrent/Σtotal bar rather than
 * last-writer-wins on the display's one status field.
 *
 * A copy of the ctx rather than a separate `slot()` on it because a display
 * should not have to know which kind of context it holds: the field is called
 * `statusCallback` in both, and `statusCallback: ctx.statusCallback` at the RPC
 * call site is correct in the fan-out and in the batched case alike. Displays
 * used to reach back to the model for `makeRegionStatusCallback(index)`, and
 * the whole hazard was that forgetting to looked exactly like remembering to.
 *
 * The fan-out's lifetime is this batch's: slots are never reclaimed, and the
 * batch is the thing that ends.
 */
function fanOutStatus(ctx: FetchContext, count: number) {
  const slot = createStatusFanOut(ctx.statusCallback)
  return Array.from({ length: count }, () => ({
    ...ctx,
    statusCallback: slot(),
  }))
}

/**
 * Run one RPC `call` per needed region, in parallel, under a single
 * stale-guarded `fetchRegions` wrapper. Centralizes the fan-out plus the two
 * `ctx.isStale()` guards every per-region display repeated by hand: skip a
 * region's commit, and skip the post-fetch step, once the user has moved on.
 * Forgetting either guard is a stale-data write, so this is a correctness
 * primitive as much as a dedup.
 *
 * `call` keeps the literal RPC method name at the call site, so its typed args
 * (`RpcCallArgs<M>`) and return (`RpcCallReturn<M>`) survive — `R` is inferred
 * from `call` and flows into `onResult` with no cast. The helper owns the
 * control flow; the display still owns its typed payload, into which it injects
 * `statusCallback: ctx.statusCallback` — the ctx `call` is handed, which is that
 * region's own status slot, so the parallel per-region fetches aggregate into
 * one bar instead of clobbering each other.
 * A display whose fetch genuinely diverges — canvas (prune + fold a too-large
 * result), MAF (a concurrent annotation fetch + a cross-region sample pick),
 * alignments (chain payload) — keeps its own `fetchNeeded` and calls
 * `fetchRegions` directly. MAF and alignments then reach for
 * {@link callEachRegion} for the fan-out; `LinearBasicDisplay` does not, and
 * should not — its per-region call already returns the `displayedRegionIndex`
 * inside its own result shape, so the pairing `callEachRegion` exists to provide
 * would be a second wrapper to unwrap. Its plain `Promise.all` is the right
 * answer there, and the single `ctx.isStale()` around the batch is deliberate:
 * it commits the batch's gate measurements atomically.
 */
export async function fetchEachRegion<R>(
  self: FetchEachRegionModel,
  needed: { region: Region; displayedRegionIndex: number }[],
  opts: {
    call: (
      region: Region,
      ctx: FetchContext,
      displayedRegionIndex: number,
    ) => Promise<R>
    onResult: (displayedRegionIndex: number, result: R) => void
    onComplete?: () => void
  },
) {
  await self.fetchRegions(needed, async ctx => {
    // per-region guard, not one around the batch: a region that arrives before
    // the user moves on still commits
    const perRegion = fanOutStatus(ctx, needed.length)
    await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }, i) => {
        const result = await opts.call(
          region,
          perRegion[i]!,
          displayedRegionIndex,
        )
        if (!ctx.isStale()) {
          opts.onResult(displayedRegionIndex, result)
        }
      }),
    )
    if (!ctx.isStale()) {
      opts.onComplete?.()
    }
  })
}

/**
 * Batched counterpart to {@link fetchEachRegion}: hands every needed region to
 * a single RPC `call`, which returns one result per region aligned to the input
 * order (`results[i]` ↔ `needed[i]`). Use when the adapter serves all regions in
 * one pass more efficiently than N independent calls — e.g. BigWig coalesces
 * adjacent on-disk blocks across region boundaries (`getFeaturesAsArraysMulti`),
 * which the per-region fan-out can't exploit; collapsed-intron views (many small
 * regions on one refName) benefit most. The single `ctx.isStale()` guard is the
 * same correctness primitive as the per-region helper — a moved-on viewport
 * skips both the commit and the post-fetch step. `call` keeps the literal RPC
 * method name at the call site so its typed args/return survive and `R` flows
 * into `onResult` with no cast.
 */
export async function fetchAllRegions<R>(
  self: FetchEachRegionModel,
  needed: { region: Region; displayedRegionIndex: number }[],
  opts: {
    call: (regions: Region[], ctx: FetchContext) => Promise<R[]>
    onResult: (displayedRegionIndex: number, result: R) => void
    onComplete?: () => void
  },
) {
  await self.fetchRegions(needed, async ctx => {
    const results = await opts.call(
      needed.map(n => n.region),
      ctx,
    )
    if (!ctx.isStale()) {
      if (results.length !== needed.length) {
        throw new Error(
          `fetchAllRegions: adapter returned ${results.length} results for ${needed.length} regions`,
        )
      }
      needed.forEach(({ displayedRegionIndex }, i) => {
        opts.onResult(displayedRegionIndex, results[i]!)
      })
      opts.onComplete?.()
    }
  })
}

// Run `clear` whenever the containing view's `displayedRegions` reference
// changes (chromosome navigation, region reorder, etc). Use for state keyed
// by `displayedRegionIndex` that intentionally survives `clearAllRpcData` —
// chromosome navigation reuses indices, so an entry left over from chr1
// would silently apply to chr2 (canvas's `densityStatsPerRegion` is the
// canonical case). Plugins whose entire per-region data clears through
// `clearDisplaySpecificData` don't need this — the mixin's own
// `DisplayedRegionsChange` autorun already covers them.
export function onDisplayedRegionsChange(
  self: IAnyStateTreeNode,
  clear: () => void,
  name = 'OnDisplayedRegionsChange',
) {
  autorunOnReadyView(
    self,
    view => {
      void view.displayedRegions
      clear()
    },
    { name },
  )
}
