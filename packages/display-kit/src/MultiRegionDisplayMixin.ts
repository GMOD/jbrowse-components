import { getSession } from '@jbrowse/core/util/mstUtils'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from './RegionTooLargeMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationPaintInert } from './foundationPaintInert.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import { containingHost, foundationCanRender } from './foundationView.ts'
import { installPerRegionFetchAutoruns } from './installPerRegionFetchAutoruns.ts'
import { isBlockCovered } from './planRegionFetch.ts'
import { makeCommitChecks } from './regionCommit.ts'
import { viewportEmpty } from './viewportEmpty.ts'

import type { IndexedRegion } from './planRegionFetch.ts'
import type { LoadedRegion, RegionFetchContext } from './regionCommit.ts'
import type { RegionHost } from './regionHost.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Region } from '@jbrowse/core/util/types/data'
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
  fetchRegionsBatched,
} from './fetchEachRegion.ts'
export type { FetchEachRegionModel } from './fetchEachRegion.ts'
export { isBlockCovered, planRegionFetch } from './planRegionFetch.ts'
export type { LoadedRegion, RegionFetchContext } from './regionCommit.ts'

/**
 * #stateModel MultiRegionDisplayMixin
 * #displayFoundationDef Per-region fetch + render: the fetch autoruns, `rpcProps()` refetch wiring, and byte gating. The common case.
 * #category display
 *
 * Per-region fetch lifecycle for LGV-based GPU displays. Installs the fetch
 * autoruns in `afterAttach` and exposes overridable hooks (`fetchNeeded`,
 * `rpcProps`, `regionFetchKey`, `regionHasData`, `gateEnabled`) plus
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
        loadedRegions: regionDataMap<LoadedRegion>('loadedRegions'),
      }))
      .views(self => ({
        /**
         * #getter
         * The containing LinearGenomeView, typed once for every display in this
         * family — see `containingHost` for the cast it owns and why both
         * foundations still declare the name.
         */
        get host(): RegionHost {
          return containingHost(self)
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
          return this.host.trackWidthPx
        },

        /**
         * #getter
         * Overrides `RenderLifecycleMixin`'s default-true hook with the LGV
         * precondition both foundations share — see `foundationCanRender`.
         */
        get canRender() {
          return foundationCanRender(this)
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
          const view = this.host
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
         * No content block is on screen, so this display has nothing to fetch
         * and nothing to paint — see `viewportEmpty.ts` for the one viewport that
         * reaches it, how narrow that is, and why the state still has to be
         * terminal rather than a permanent scrim. Both foundations declare it
         * over that one expression, the same way they each declare `host` and
         * `paintInert`.
         */
        get viewportEmpty(): boolean {
          return viewportEmpty(this.host)
        },

        /**
         * #getter
         * Overridable hook (default false): whether a searchable feature layout
         * currently exists. Any display defining a feature-lookup method
         * (`searchFeatureByID`, `getFeatureById`) must override it, so callers can
         * tell "laid out, but off-display" from "no layout exists yet" — a
         * distinction only the display can make. See
         * packages/display-kit/CLAUDE.md §"Four
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
         * **The fail-open default is load-bearing, not an omission.** A
         * byte-gate refusal never marks a region loaded (the commit sits beside
         * the store and skips refused results), so "marked loaded with nothing
         * behind it" is unreachable from the gate — the one path that stamps
         * without storing is sequence's legitimately-empty-region answer, and a
         * store-derived default there would refetch forever: stamp, store
         * nothing, read uncovered, fetch again. `true` is what lets "this fetch
         * completed and there is genuinely nothing here" be a terminal state.
         *
         * A view, not an action, for the reason `regionFetchKey` is a getter.
         */
        regionHasData(_displayedRegionIndex: number): boolean {
          return true
        },

        /**
         * #getter
         * Overridable hook (default false): the held data is loaded and covers
         * the viewport, but a fetch input this display has *already settled on*
         * has moved past it — so the data is about to be cleared and refetched.
         * A display says so here rather than overriding `dataCurrent`, for the
         * reason `FetchMixin.fetchInert` is a hook: an override has to restate
         * the freshness terms and then misses the next one added.
         *
         * On screen this window is invisible (the clear lands a tick later and
         * the loading scrim covers it), which is exactly why it needs saying:
         * `awaitSvgReady` samples freshness once, and an export that samples it
         * inside this window renders the data that is about to be discarded —
         * or, once the clear lands mid-render, nothing at all. GWAS's LD
         * auto-index is the case: adopting the top hit as the index SNP is an
         * `rpcProps` change, so the very load that produced the top hit is what
         * it invalidates.
         */
        get dataSuperseded(): boolean {
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
          return buildRenderBlocks(this.host.visibleRegions)
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
         *
         * `dataSuperseded` is the third term: data that a settled fetch-input
         * change is about to invalidate answers nothing about what is on screen
         * a tick from now, so it is not current either.
         */
        get dataCurrent(): boolean {
          return (
            self.viewportWithinLoadedData &&
            self.loadedRegions.size > 0 &&
            !self.dataSuperseded
          )
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
         * only the freshness half, which `foundationSvgReady` reads as
         * `dataCurrent` or the vacuous currency of `viewportEmpty`. Off-screen
         * renderers gate on it via `awaitSvgReady(model)` instead of inlining
         * the condition.
         */
        get svgReady(): boolean {
          return foundationSvgReady(self)
        },

        /**
         * #getter
         * Fills `RenderLifecycleMixin`'s `paintInert` hook — see there for why a
         * failed fetch has to read as finished to the consumers outside the
         * display, and `foundationPaintInert` for the second such state and why
         * both fetch families answer it through one function. Overridable, as
         * the hook is: a display with a third inert state of its own says so
         * here.
         */
        get paintInert(): boolean {
          return foundationPaintInert(self)
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
         * Overridable hook (no-op base): override to call one of the three
         * helpers in `fetchEachRegion.ts` — `fetchEachRegion` (one RPC per
         * region), `fetchAllRegions` (one RPC, one result per region) or
         * `fetchRegionsBatched` (one RPC, one payload covering all of them).
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
         */
        isCacheValid(displayedRegionIndex: number): boolean {
          return (
            self.regionHasData(displayedRegionIndex) &&
            self.loadedRegions.get(displayedRegionIndex)?.fetchKey ===
              self.regionFetchKey
          )
        },
      }))
      .actions(self => {
        const checks = makeCommitChecks(self)
        return {
          /**
           * #action
           * Run a per-region fetch. The work callback
           * calls `ctx.commitRegion` as it stores each region's payload, which is
           * what marks it loaded — see {@link RegionFetchContext} for why this
           * function no longer does that itself. Its only callers are the three
           * helpers in `fetchEachRegion.ts`, which make that call for every
           * display in the family; a display reaching past them owns both
           * `ctx.isStale()` guards and the commit by hand, and none does.
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
