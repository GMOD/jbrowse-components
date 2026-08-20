import { getContainingView } from '@jbrowse/core/util'
import { getType, types } from '@jbrowse/mobx-state-tree'
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

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { FetchContext } from './FetchMixin.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type { Region } from '@jbrowse/core/util'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

export type { FetchContext } from './FetchMixin.ts'

// This ESM package builds without @types/node, but consuming bundlers still
// string-replace `process.env.NODE_ENV`, so keep the reference and give it a
// minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

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
 * A {@link FetchContext} plus the one thing a per-region fetch can do that a
 * global one cannot: record that a region is loaded.
 *
 * **`commitRegion` is called where the payload is stored, and that is the whole
 * rule.** `loadedRegions` is the span `isBlockCovered` judges the viewport
 * against, so it has to describe data that exists. It used to be written by
 * `fetchRegions` from the region list it *asked* for, once the work callback
 * returned — a second writer, working off the request while the display worked
 * off the response, and the two disagree exactly when a fetch stores less than
 * it asked for. A region refused by the in-fetch size gate then read as covered
 * against data it never received: the plan answered `covered` on every later
 * run, so nothing refetched and — because the ordinary fetch IS the gate's
 * re-measure — nothing re-measured either. On the byte axis that is a banner no
 * zoom can release; on the density axis, which falls with `bpPerPx`, the banner
 * goes and the display paints the previous, narrower payload across the whole
 * viewport with nothing on screen to say so.
 *
 * **The span is not a parameter**, and that is the half that makes the rule
 * structural rather than advisory: `commitRegion` names an index, and
 * `fetchRegions` resolves it against the very `needed` list it issued. A display
 * can say "this region landed" and nothing else — it cannot name a span, so it
 * cannot claim one the fetch never asked for. What is left to get wrong is
 * forgetting the call, which costs a redundant refetch; the direction that cost
 * a display frozen until reload is now unreachable.
 *
 * The global family reached the same property from the other side.
 * `GlobalFetchPhases.commit` is a phase the skeleton invokes only when `run`
 * produced a result, so nothing is recorded from the request there either.
 * Per-region cannot simply adopt those phases: four displays make a
 * cross-region decision mid-fetch (a batched gate commit, a sample-set union, a
 * tag-map union, one RPC serving every region), and a strict per-region
 * `run`/`commit` has nowhere to put it. Same invariant, two shapes, and the
 * reason they differ is that one dataset arrives once and N regions stream.
 */
export interface RegionFetchContext extends FetchContext {
  /**
   * Record that this region's data is now held. Over the span `fetchRegions`
   * asked for it, resolved from `needed` — see above for why that is not the
   * caller's to choose. Ignored once the fetch is stale, which is the same
   * guard the write has always had, moved to where the write happens.
   */
  commitRegion: (displayedRegionIndex: number) => void
}

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
        loadedRegions: regionDataMap<Region>(),
        /**
         * #volatile
         * The `regionFetchKey` each loaded region's fetch was issued under,
         * keyed by displayedRegionIndex. Written by `setLoadedRegion` beside
         * `loadedRegions`, so the two never disagree about a region, and read
         * only by `isCacheValid`.
         */
        loadedFetchKeys: regionDataMap<string>(),
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
         * mode. Stamps the region with the fetch key its data came back under —
         * `fetchRegions` passes the key it captured before issuing the RPC, and
         * the default serves a caller committing a region it holds right now.
         */
        setLoadedRegion(
          displayedRegionIndex: number,
          region: Region,
          fetchKey = self.regionFetchKey,
        ) {
          self.loadedRegions.set(displayedRegionIndex, region)
          self.loadedFetchKeys.set(displayedRegionIndex, fetchKey)
        },

        /**
         * #action
         * Forget one region, both halves together, so a display pruning what has
         * scrolled off screen cannot leave a key behind its data.
         */
        dropLoadedRegion(displayedRegionIndex: number) {
          self.loadedRegions.delete(displayedRegionIndex)
          self.loadedFetchKeys.delete(displayedRegionIndex)
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
          self.loadedFetchKeys.clear()
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
            untracked(() => self.loadedFetchKeys.get(displayedRegionIndex)) ===
              self.regionFetchKey
          )
        },
      }))
      .actions(self => {
        // Dev-only, and the counter is why it is a closure: forgetting
        // `ctx.commitRegion` is the one way left to get the rule wrong, and it
        // spins rather than freezing — the region never reads as covered, so
        // the plan asks again, the fetch ends, `fetchGeneration` bumps, and the
        // autorun re-fires. Loud in a network tab and invisible in a test, which
        // is the shape a check is worth having for.
        //
        // Consecutive, not the first occurrence: a fetch can legitimately store
        // nothing while `regionTooLarge` is still false for a settled cycle,
        // since the worker gates on the live `bpPerPx` and the main-thread
        // verdict reads the debounced one. That resolves within a debounce; a
        // missing call does not.
        let emptyFetchRuns = 0
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
                  const region = issued.get(displayedRegionIndex)
                  if (region === undefined) {
                    // Not one of the regions this fetch asked for, so there is no
                    // span it could honestly be marked loaded over. Dropped rather
                    // than guessed — under-claiming costs a refetch, and the
                    // alternative is the claim this whole mechanism exists to
                    // prevent. Reported because a display committing a region it
                    // did not fetch is a bug in the display, not a state to
                    // recover from.
                    console.error(
                      `[jbrowse display contract] commitRegion(${displayedRegionIndex}) ` +
                        `names a region this fetch did not ask for (it issued ` +
                        `${[...issued.keys()].join(', ') || 'none'}), so nothing was ` +
                        `marked loaded. See RegionFetchContext.`,
                    )
                  } else if (!ctx.isStale()) {
                    committed++
                    self.setLoadedRegion(displayedRegionIndex, region, fetchKey)
                  }
                },
              })
              if (process.env.NODE_ENV !== 'production' && !ctx.isStale()) {
                emptyFetchRuns =
                  committed === 0 && needed.length > 0 && !self.regionTooLarge
                    ? emptyFetchRuns + 1
                    : 0
                if (emptyFetchRuns === 3) {
                  console.error(
                    `[jbrowse display contract] ${getType(self).name}: three fetches ` +
                      `in a row stored data for no region and nothing is gating them, ` +
                      `so the plan will keep asking for the same regions. A work ` +
                      `callback that stores a payload must call ` +
                      `\`ctx.commitRegion(displayedRegionIndex)\` beside the store — ` +
                      `see RegionFetchContext.`,
                  )
                }
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
