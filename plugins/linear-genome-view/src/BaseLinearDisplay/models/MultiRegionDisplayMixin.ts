import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { regionDataMap } from '@jbrowse/render-core/installPerRegionLifecycle'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.ts'
import FetchMixin from './FetchMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import { installPerRegionFetchAutoruns } from './installPerRegionFetchAutoruns.ts'
import { isBlockCovered } from './planRegionFetch.ts'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { FetchContext } from './FetchMixin.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type { Region } from '@jbrowse/core/util'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

export type { FetchContext } from './FetchMixin.ts'

// The fan-out helpers and the view-lifecycle autorun helpers moved to their own
// files; re-exported so a consumer still has one import for the family.
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
          needed: IndexedRegion[],
          work: (ctx: FetchContext) => Promise<void>,
        ) {
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
