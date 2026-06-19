import {
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { getTrackAssemblyNames } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { autorun, observable, untracked } from 'mobx'

import FetchMixin from './FetchMixin.ts'
import { checkByteEstimate } from './fetchHelpers.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

import type { FetchContext } from './FetchMixin.ts'
import type { ByteEstimateConfig } from './fetchHelpers.ts'
import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

export type { ByteEstimateConfig } from './fetchHelpers.ts'
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
 * #category display
 *
 * Per-region fetch lifecycle for LGV-based GPU displays. Installs four autoruns
 * in `afterAttach` and exposes overridable hooks (`fetchNeeded`, `rpcProps`,
 * `isCacheValid`, `getByteEstimateConfig`, `clearDisplaySpecificData`) plus the
 * `fetchRegions` / `loadedRegions` machinery.
 */
export default function MultiRegionDisplayMixin() {
  return types
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
      loadedRegions: observable.map<number, Region>(),
    }))
    .views(self => ({
      /**
       * #getter
       * true once the canvas has painted and no fetch is in flight
       */
      get isReady() {
        return self.canvasDrawn && !self.isLoading
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
        const view = getContainingView(self) as LinearGenomeViewModel
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
       * true once an off-screen (SVG) export can safely read this display's
       * data: every visible region has loaded, or the fetch reached a terminal
       * error / too-large state. Off-screen renderers gate on it via
       * `awaitSvgReady(model)` instead of inlining the condition. Regions
       * stream in one at a time, so gating on `viewportWithinLoadedData` (not the
       * first datum) is what keeps multi-region/whole-genome exports complete;
       * `loadedRegions.size` guards the vacuously-true empty-viewport case.
       */
      get svgReady(): boolean {
        return (
          (this.viewportWithinLoadedData && self.loadedRegions.size > 0) ||
          !!self.error ||
          self.regionTooLarge ||
          this.svgReadyExtraTerminal
        )
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
       * Shared cached view for every LGV-based GPU display. A single
       * displayedRegion may produce multiple render blocks (shared GPU
       * buffer, different scissor clips on screen). Plugins that want to
       * suppress rendering in certain states (e.g. no domain yet) can
       * override this getter to return [] — the autorun lifecycle will
       * then issue an empty-blocks render that clears the canvas.
       */
      get renderBlocks() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return buildRenderBlocks(view.visibleRegions)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The display's mutually-exclusive visual state, precedence single-sourced
       * in `computeDisplayPhase`. Here `loading` means data isn't ready yet, or
       * stale data (viewport past loaded) is still on screen through the
       * pre-refetch debounce.
       */
      get displayPhase(): DisplayPhase {
        // fetchCanceled keeps the overlay up (showing its retry affordance)
        // after the user canceled mid-load
        return computeDisplayPhase(
          self,
          () =>
            !self.isReady ||
            !self.viewportWithinLoadedData ||
            self.fetchCanceled,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The single signal every display's loading overlay reads. Derived from
       * `displayPhase` so the loading-vs-terminal precedence isn't re-encoded by
       * subtraction. Separate `.views` block so it can read the sibling
       * `displayPhase` getter through `self`.
       */
      get loadingOverlayVisible() {
        return self.displayPhase === 'loading'
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
       * full reset: cancels fetch, clears error, regionTooLarge,
       * loadedRegions, display-specific data, and the canvas-drawn flag
       */
      clearAllRpcData() {
        self.cancelFetch()
        self.setError(undefined)
        self.setRegionTooLarge(false)
        self.loadedRegions.clear()
        self.clearDisplaySpecificData()
        self.resetCanvasDrawn()
      },

      /**
       * #action
       * Default reload: full reset. Subclasses with extra teardown can
       * override (and chain to `clearAllRpcData` directly if needed).
       */
      reload() {
        this.clearAllRpcData()
      },

      /**
       * #action
       * lighter reset: cancels fetch and clears loadedRegions, leaving error
       * and regionTooLarge intact
       */
      invalidateLoadedRegions() {
        self.cancelFetch()
        self.loadedRegions.clear()
      },
    }))
    .actions(_self => ({
      /**
       * #action
       * Overridable hook (no-op base): override to call
       * `this.fetchRegions(needed, async ctx => { ... })`.
       */
      fetchNeeded(_needed: { region: Region; displayedRegionIndex: number }[]) {
        // no-op base
      },

      /**
       * #action
       * Overridable hook: return `false` to force re-fetch at the current
       * zoom (wiggle uses this for zoom-level changes).
       */
      isCacheValid(_displayedRegionIndex: number): boolean {
        return true
      },

      /**
       * #action
       * Overridable hook: return config to enable byte-estimate gating
       * before fetch.
       */
      getByteEstimateConfig(): ByteEstimateConfig | null {
        return null
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
        await self.runFetch(async ctx => {
          const byteEstimateConfig = self.getByteEstimateConfig()
          if (byteEstimateConfig) {
            const session = getSession(self)
            const result = await checkByteEstimate(
              session.rpcManager,
              getRpcSessionId(self),
              needed.map(r => r.region),
              byteEstimateConfig,
              ctx,
            )
            if (ctx.isStale()) {
              return
            }
            if (result) {
              self.setFeatureDensityStats(result.stats)
              if (result.tooLarge) {
                self.setRegionTooLarge(true, result.reason)
                return
              }
            }
          }
          self.setRegionTooLarge(false)
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
       * installs the four fetch-lifecycle autoruns (DisplayedRegionsChange,
       * FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange)
       */
      afterAttach() {
        // Clear loaded data whenever the displayed-regions list
        // changes. `displayedRegions` is a frozen array on the LGV
        // model, so any mutation replaces the reference and the
        // autorun re-fires on the bare read below. Fires once at
        // mount as a harmless no-op (nothing loaded yet).
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(self) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              void view.displayedRegions
              self.clearAllRpcData()
            },
            { name: 'DisplayedRegionsChange' },
          ),
        )

        // Autorun: fetch data when the visible viewport isn't covered
        // by loaded data. Fetches with an explicit buffer for smooth
        // scrolling without blank gaps.
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(self) as LinearGenomeViewModel
              void self.fetchGeneration
              if (
                !view.initialized ||
                self.error ||
                self.regionTooLarge ||
                self.fetchCanceled
              ) {
                return
              }

              // perf guard: isLoading flip would re-fire this autorun mid-fetch;
              // fetchGeneration (bumped after fetch) is the real re-trigger.
              if (untracked(() => self.isLoading)) {
                return
              }

              const { assemblyManager } = getSession(self)
              const trackAssemblyNames = getTrackAssemblyNames(
                getContainingTrack(self),
              )
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
              if (needed.length > 0) {
                self.fetchNeeded(needed)
              }
            },
            {
              name: 'FetchVisibleRegions',
              delay: 600,
            },
          ),
        )

        // Re-fetch when track config changes. Each subclass defines its own
        // typed rpcProps() — reading it once tracks every param as a cache
        // key. Looked up dynamically because the mixin doesn't declare the
        // method on its public interface (subclasses keep their narrow
        // return types unwidened by a base default).
        const rpcProps = (self as { rpcProps?: () => unknown }).rpcProps
        if (rpcProps) {
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                void rpcProps.call(self)
                self.clearAllRpcData()
              },
              { name: 'SettingsInvalidate' },
            ),
          )
        }

        // When zoom or viewport position changes while regionTooLarge,
        // error, or fetchCanceled is set, clear so the fetch autorun
        // retries. Reads them untracked so setting them doesn't trigger
        // this autorun to immediately wipe them — only the viewport read
        // should fire it.
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(self) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              void view.visibleRegions
              if (
                untracked(
                  () => self.regionTooLarge || self.fetchCanceled || self.error,
                )
              ) {
                self.clearAllRpcData()
              }
            },
            { name: 'ClearBlockingStateOnViewportChange' },
          ),
        )
      },
    }))
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>

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
  addDisposer(
    self,
    autorun(
      () => {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        void view.displayedRegions
        clear()
      },
      { name },
    ),
  )
}
