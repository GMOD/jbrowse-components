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
import type { IAutorunOptions } from 'mobx'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

export { checkByteEstimate } from './fetchHelpers.ts'
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
       * no explicit clear here — it self-releases when the viewport changes.
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

      /**
       * #action
       * Overridable hook (no-op base): called when `regionTooLarge` transitions
       * to true. Displays with transient hover/tooltip state override it to clear
       * that state — the too-large banner replaces the rendered content, so a
       * lingering hover would otherwise pin to a now-hidden feature. Wired to the
       * `ClearHoverOnRegionTooLarge` autorun so it fires for the imperative and
       * derived gates alike.
       */
      onRegionTooLarge() {},
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
            const stats = await checkByteEstimate(
              session.rpcManager,
              getRpcSessionId(self),
              needed.map(r => r.region),
              byteEstimateConfig,
              ctx,
            )
            if (ctx.isStale()) {
              return
            }
            if (stats) {
              self.setFeatureDensityStats(stats)
              // The derived regionTooLarge getter reflects the just-captured
              // estimate (setFeatureDensityStats recorded the current viewport as
              // its capture span), so short-circuit the download when it's over
              // budget.
              if (self.regionTooLarge) {
                return
              }
            }
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
       * installs the four fetch-lifecycle autoruns (DisplayedRegionsChange,
       * FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange)
       */
      afterAttach() {
        // Clear loaded data whenever the displayed-regions list
        // changes. `displayedRegions` is a frozen array on the LGV
        // model, so any mutation replaces the reference and the
        // autorun re-fires on the bare read below. Fires once at
        // mount as a harmless no-op (nothing loaded yet).
        autorunOnReadyView(
          self,
          view => {
            void view.displayedRegions
            self.clearAllRpcData()
          },
          { name: 'DisplayedRegionsChange' },
        )

        // Autorun: fetch data when the visible viewport isn't covered
        // by loaded data. Fetches with an explicit buffer for smooth
        // scrolling without blank gaps.
        autorunOnReadyView(
          self,
          view => {
            void self.fetchGeneration
            if (self.error || self.regionTooLarge || self.fetchCanceled) {
              return
            }

            // perf guard: isLoading flip would re-fire this autorun mid-fetch;
            // fetchGeneration (bumped after fetch) is the real re-trigger.
            if (untracked(() => self.isLoading)) {
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
                return
              }
            }

            const bufferedByIndex = new Map(
              view.bufferedVisibleRegions.map(b => [b.displayedRegionIndex, b]),
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
        )

        // Re-fetch when track config changes. Each subclass defines its own
        // typed rpcProps() — reading it once tracks every param as a cache
        // key. Looked up dynamically because the mixin doesn't declare the
        // method on its public interface (subclasses keep their narrow
        // return types unwidened by a base default).
        const rpcProps = (self as { rpcProps?: () => unknown }).rpcProps
        if (rpcProps) {
          const loopGuard = makeSettingsLoopGuard('SettingsInvalidate')
          autorunOnReadyView(
            self,
            () => {
              void rpcProps.call(self)
              loopGuard()
              self.clearAllRpcData()
            },
            { name: 'SettingsInvalidate' },
          )
        }

        // When zoom or viewport position changes while an error or a canceled
        // fetch is set, clear so the fetch autorun retries. (The too-large gate
        // is derived — a pure function of the viewport — so it self-releases and
        // needs no clear here; only the terminal error/cancel states, which are
        // imperative flags, do.) Reads them untracked so setting them doesn't
        // trigger this autorun to immediately wipe them — only the viewport read
        // should fire it.
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

        // Clear display-specific transient state (hover/tooltip) whenever
        // `regionTooLarge` becomes true — the banner replaces the rendered
        // content, so a lingering hover would pin to a now-hidden feature. Fires
        // the overridable `onRegionTooLarge` hook on the transition; no-op unless
        // the display overrides the hook.
        autorunOnReadyView(
          self,
          () => {
            if (self.regionTooLarge) {
              self.onRegionTooLarge()
            }
          },
          { name: 'ClearHoverOnRegionTooLarge' },
        )
      },
    }))
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
 * The classic `rpcProps()` trap (ARCHITECTURE.md "rpcProps() loop trap") puts a
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
 * control flow; the display still owns its typed payload (and the structural
 * args + `statusCallback: self.makeRegionStatusCallback(displayedRegionIndex)`
 * it injects there — the index is the third `call` argument, so the parallel
 * per-region fetches aggregate into one bar instead of clobbering each other).
 * A display whose fetch genuinely diverges — canvas (prune + fold a too-large
 * result), MAF (summary vs detail), alignments (chain payload) — keeps its own
 * `fetchNeeded` and calls `fetchRegions` directly instead.
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
    await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }) => {
        const result = await opts.call(region, ctx, displayedRegionIndex)
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
