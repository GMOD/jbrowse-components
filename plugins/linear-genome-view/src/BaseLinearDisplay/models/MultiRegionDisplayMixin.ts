import { getContainingView, getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { regionDataMap } from '@jbrowse/render-core/installPerRegionLifecycle'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { untracked } from 'mobx'

import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.ts'
import FetchMixin from './FetchMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import { installPerRegionFetchAutoruns } from './installPerRegionFetchAutoruns.ts'
import { isBlockCovered } from './planRegionFetch.ts'
import { makeCommitChecks } from './regionCommit.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type { LoadedRegion, RegionFetchContext } from './regionCommit.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Region } from '@jbrowse/core/util'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

export type { FetchContext } from './FetchMixin.ts'

// The fan-out helpers, the view-lifecycle autoruns, the plan and the commit
// contract each live in their own file; re-exported so a consumer still has one
// import for the family.
export {
  autorunOnReadyView,
  makeSettingsLoopGuard,
  onDisplayedRegionsChange,
} from './displayAutoruns.ts'
export {
  callEachRegion,
  fetchAllRegions,
  fetchEachRegion,
} from './fetchEachRegion.ts'
export { isBlockCovered, planRegionFetch } from './planRegionFetch.ts'
export type { LoadedRegion, RegionFetchContext } from './regionCommit.ts'

/**
 * #stateModel MultiRegionDisplayMixin
 * #displayFoundationDef Per-region fetch + render: the fetch autoruns, `rpcProps()` refetch wiring, and byte gating. The common case.
 * #category display
 *
 * Per-region fetch lifecycle for LGV-based GPU displays. Installs the fetch
 * autoruns in `afterAttach` and exposes overridable hooks (`fetchNeeded`,
 * `rpcProps`, `regionFetchKey`, `regionHasData`, `measuresBytesPreFlight`) plus
 * the `fetchRegions` / `loadedRegions` machinery.
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
        loadedRegions: regionDataMap<LoadedRegion>(),
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
         * Overridable hook (default `''`): what a fetch issued right now would
         * produce for a region, as a string — the display's per-region content
         * axis. `fetchRegions` captures it before it issues the RPC and stamps
         * it beside the loaded region; `isCacheValid` refetches a region whose
         * stamp no longer matches. Wiggle returns `String(view.bpPerPx)`
         * (adr-008), canvas the peptide-overlay threshold, the variant matrix
         * its zoom in matrix mode only.
         *
         * NOT an `rpcProps()` field: this invalidates one region's held data
         * where `rpcProps` invalidates all of it, and a zoom-swinging value in
         * the RPC payload blanks the display at the force-load floor — see
         * REGION_TOO_LARGE.md §"How the verdict is built".
         *
         * A getter, so the observables it reads register as dependencies of
         * `FetchVisibleRegions`; MobX runs an action untracked and the autorun
         * would keep a stale answer.
         */
        get regionFetchKey(): string {
          return ''
        },

        /**
         * #method
         * Overridable hook (default true): whether the display can actually
         * draw what this region is marked loaded over. Two different displays
         * want it for two different reasons, and both are real:
         *
         * - **The reader-side check of the write-side rule.** `loadedRegions` is
         *   written where the payload is stored (`RegionFetchContext`), so an
         *   entry with nothing behind it means that rule was broken somewhere.
         *   Answering off the data map costs a lookup and decides which way the
         *   break fails: a refetch, or a viewport that reads as covered against
         *   data nobody has and never asks again. Both canvas displays.
         * - **Which of several held payloads answers.** MAF caches a summary
         *   tier and a detail tier side by side under one
         *   `displayedRegionIndex`, so crossing the threshold inside an
         *   already-loaded region changes which map has to answer — something
         *   the coverage bounds cannot see at all.
         *
         * Separate from `regionFetchKey` on purpose: for MAF a key would refetch
         * the summary on every zoom back out, since both tiers are still held.
         * And the mixin cannot see a display's data map, so a key that changed
         * when data arrived would be the `rpcProps()` loop in different clothes.
         *
         * A view, not an action, for the reason `regionFetchKey` is a getter.
         */
        regionHasData(_displayedRegionIndex: number): boolean {
          return true
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

        /**
         * #getter
         * The assembly the data in hand came from, once it can answer about
         * refNames — `undefined` before that.
         *
         * Off the first LOADED region rather than the view's displayed ones,
         * which is the distinction that makes it belong here: a display holding
         * fetched data is asking about the assembly THAT data is on, and the
         * view's regions can already have moved on.
         *
         * The `initialized` gate is why this returns the assembly rather than
         * its name. `getCanonicalRefName2` and `refNameToIndex` answer WRONGLY
         * rather than throwing before the aliases land — identity, and a miss —
         * so a caller that skips the gate gets a plausible answer and no signal.
         * Handing back `undefined` until it can answer is what makes the caller
         * write its fallback.
         */
        get loadedAssembly(): Assembly | undefined {
          const firstRegion = self.loadedRegions.values().next().value
          const assembly = firstRegion
            ? getSession(self).assemblyManager.get(firstRegion.assemblyName)
            : undefined
          return assembly?.initialized ? assembly : undefined
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
         * A subclass customizes this through `fetchInert` (FetchMixin),
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
         * The raw write behind `ctx.commitRegion`, and **not what a fetch should
         * call**: a display naming its own span is the bug this family spent a
         * release on, and going through the context is what makes that
         * inexpressible — see {@link RegionFetchContext}. Direct callers are
         * tests staging an already-loaded display.
         *
         * An action so callers after an async boundary stay in MST strict mode.
         * Stamps the region with the fetch key its data came back under.
         * `fetchRegions` passes the key it captured before issuing the RPC; the
         * default reads it *now*, which is right for a caller holding the region
         * already and wrong for anything resuming after an await, where the
         * viewport may have moved under the fetch.
         */
        setLoadedRegion(
          displayedRegionIndex: number,
          region: Region,
          // annotated, not inferred: `self` here is mid-composition, so the
          // default's type lands as `any` and the published signature stopped
          // constraining the one field `isCacheValid` compares
          fetchKey: string = self.regionFetchKey,
        ) {
          self.loadedRegions.set(displayedRegionIndex, { ...region, fetchKey })
        },

        /**
         * #action
         * Forget one region — for a display pruning what has scrolled off
         * screen.
         */
        dropLoadedRegion(displayedRegionIndex: number) {
          self.loadedRegions.delete(displayedRegionIndex)
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
         * bumping it. Missing it doesn't break the retry, which the
         * `clearAllRpcData` call drives; it turns the dev-only retry check off
         * for that display, silently. Both overrides in the tree chain now —
         * `MultiSampleVariantBaseModel` always did, canvas's `LinearBasicDisplay`
         * did not, and that took `LinearVariantDisplay` with it — and
         * `reloadReachesCounter.test.ts` reads every `reload()` in the tree
         * rather than leaving the next one to this paragraph.
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
        fetchNeeded(_needed: IndexedRegion[]) {
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
      // override. `regionFetchKey` and `regionHasData` are views for the same
      // reason.
      .views(self => ({
        /**
         * #method
         * Whether the data held for a region still answers the current view.
         * Not a hook a display fills: a display states its rule as
         * `regionFetchKey` (what a fetch now would produce) and `regionHasData`
         * (did the last one store anything), and this compares the key against
         * the one the region was fetched under. A subclass that changes what it
         * fetches spells the change in the key, and one that forgets gets a
         * redundant fetch rather than a cached answer for a zoom the data was
         * never fetched at.
         *
         * The stamp is read `untracked` for the reason `FetchVisibleRegions`
         * reads `loadedRegions` untracked: that autorun is what writes it, and
         * the `fetchGeneration` bump at fetch end is the re-trigger.
         */
        isCacheValid(displayedRegionIndex: number): boolean {
          return (
            self.regionHasData(displayedRegionIndex) &&
            untracked(
              () => self.loadedRegions.get(displayedRegionIndex)?.fetchKey,
            ) === self.regionFetchKey
          )
        },
      }))
      .actions(self => {
        const checks = makeCommitChecks(self)
        return {
          /**
           * #action
           * Run a per-region fetch with byte-estimate gating. The work callback
           * calls `ctx.commitRegion` as it stores each region's payload, which is
           * what marks it loaded — see {@link RegionFetchContext} for why this
           * function no longer does that itself. The fan-out helpers
           * (`fetchEachRegion`, `fetchAllRegions`) make the call for the displays
           * that use them.
           *
           * The fetch key is captured here, at issue, and carried into every
           * commit — never re-read after the await. `ctx.isStale()` trips on a
           * newer fetch or a cancel, not on a viewport that moved under a fetch
           * that is still current, so a key read at commit time would stamp this
           * data with a zoom it was not fetched at.
           */
          async fetchRegions(
            needed: IndexedRegion[],
            work: (ctx: RegionFetchContext) => Promise<void>,
          ) {
            const fetchKey = self.regionFetchKey
            const issued = new Map(
              needed.map(n => [n.displayedRegionIndex, n.region]),
            )
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
              let committed = 0
              await work({
                ...ctx,
                commitRegion: displayedRegionIndex => {
                  // The span is the one this fetch asked for, looked up rather
                  // than taken from the caller — see RegionFetchContext. An
                  // index that is not in it has no span to be honest about, so
                  // the commit is dropped: under-claiming costs a refetch, and
                  // the alternative is the claim this mechanism exists to
                  // prevent.
                  const region = issued.get(displayedRegionIndex)
                  if (region === undefined) {
                    checks.unknownRegion(displayedRegionIndex, issued.keys())
                  } else if (!ctx.isStale()) {
                    committed++
                    self.setLoadedRegion(displayedRegionIndex, region, fetchKey)
                  }
                },
              })
              if (!ctx.isStale() && needed.length > 0) {
                checks.fetchEnded({ committed, gated: self.regionTooLarge })
              }
            })
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         * installs the fetch-lifecycle autoruns (DisplayedRegionsChange,
         * FetchVisibleRegions, SettingsInvalidate,
         * ClearBlockingStateOnViewportChange)
         */
        afterAttach() {
          installPerRegionFetchAutoruns(
            // `clearHoveredFeature` is `BaseDisplay`'s and this mixin does not
            // compose it — the same shape as `WiggleScoreConfigMixin`'s
            // `confNode(self)`, and the cast names exactly what is read.
            self as typeof self & { clearHoveredFeature: () => void },
          )
        },
      }))
  )
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>
