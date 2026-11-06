import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { getSession } from '@jbrowse/core/util/mstUtils'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from './RegionTooLargeMixin.ts'
import { makeFetchInputs } from './fetchInputs.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationPaintInert } from './foundationPaintInert.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import {
  containingHost,
  foundationCanRender,
  onTrackAssembly,
  trackCanvasWidthPx,
} from './foundationView.ts'
import {
  installPerRegionFetchAutoruns,
  planVisibleRegionFetch,
} from './installPerRegionFetchAutoruns.ts'
import { isBlockCovered } from './planRegionFetch.ts'
import { makeCommitChecks, payloadServesZoom } from './regionCommit.ts'
import { subPixelBinBp } from './subPixelBinBp.ts'
import { viewportEmpty } from './viewportEmpty.ts'

import type { FetchInputs } from './fetchInputs.ts'
import type { IndexedRegion } from './planRegionFetch.ts'
import type {
  LoadedRegion,
  RegionFetchContext,
  RegionPayload,
} from './regionCommit.ts'
import type { RegionHost } from './regionHost.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Region } from '@jbrowse/core/util/types/data'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * The store's bound in regions, on history rather than the viewport: what the
 * view buffers is always kept, and the cap decides how much of what the reader
 * panned away from stays for the pan back. The byte gate bounds each entry's
 * size.
 */
export const MAX_STORED_REGIONS = 32

/**
 * #stateModel MultiRegionDisplayMixin
 * #displayFoundationDef Per-region fetch + render: the fetch autoruns, `rpcProps()` refetch wiring, and byte gating. The common case.
 * #category display
 *
 * Per-region fetch lifecycle for LGV-based GPU displays. Installs the fetch
 * autoruns in `afterAttach` and exposes overridable hooks (`fetchNeeded`,
 * `rpcProps`, `zoomFetchArgs`, `regionHasData`, `gateEnabled`) plus
 * the `fetchRegions` / `loadedRegions` machinery.
 *
 * `rpcProps()` and `zoomFetchArgs()` are what the display's RPC is sent, and
 * the foundation stamps both beside every region a fetch loads. They differ in
 * what a move shows: an `rpcProps` move supersedes the in-flight fetch and
 * scrims the held data, while a `zoomFetchArgs` move lets the held regions draw
 * until the refetch lands, so a value that swings with zoom goes in
 * `zoomFetchArgs`. A zoom rule that is no worker argument, such as a payload
 * answering only the zoom it was fetched at, is a `regionHasData` answer. The
 * mixin looks both up rather than declaring them, so a display keeps its narrow
 * return types through MST's `.views()` chain.
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
         * The per-region store, keyed by `displayedRegionIndex`: the span a
         * fetch asked for, the `fetchInputs` it was issued under and the
         * `payload` it brought back, written as one record by
         * `ctx.commitRegion`. Displays read payloads through `regionPayloads`.
         */
        loadedRegions: regionDataMap<LoadedRegion>('loadedRegions'),
      }))
      .views(self => ({
        /**
         * #getter
         * The view this display reads regions, viewport and scale from; see
         * `containingHost`.
         */
        get host(): RegionHost {
          return containingHost(self)
        },

        /**
         * #getter
         * The CSS width of this display's on-screen canvas, in px; see
         * `trackCanvasWidthPx`.
         */
        get canvasWidthPx(): number {
          return trackCanvasWidthPx(this.host)
        },

        /**
         * #getter
         * Genomic bp one cell of a per-base pass stands for at the settled
         * zoom: `subPixelBinBp` off the host's throttled `coarseBpPerPx`, and 1
         * until the view initializes. A per-base encode or fetch reads this
         * rather than the live zoom so a wheel tick does not redo every region.
         */
        get settledSubPixelBinBp(): number {
          const view = this.host
          return view.initialized ? subPixelBinBp(view.coarseBpPerPx) : 1
        },

        /**
         * #getter
         * `RenderLifecycleMixin`'s hook: the view has initialized.
         */
        get canRender() {
          return foundationCanRender(this)
        },

        /**
         * #getter
         * `RenderLifecycleMixin`'s hook: a display that will not fetch shows a
         * placeholder where its canvas would be.
         */
        get rendersCanvas(): boolean {
          return !self.fetchInert
        },

        /**
         * #getter
         * The visible blocks on the track's own assemblies, the ones this
         * display fetches and is judged against. A view of several genomes
         * leaves a single-genome track's other regions blank.
         */
        get trackVisibleRegions() {
          const onTrack = onTrackAssembly(self)
          return this.host.visibleRegions.filter(b => onTrack(b.assemblyName))
        },

        /**
         * #getter
         * Every visible block lies within a fetched region, so the viewport
         * shows loaded data rather than the fringe a pan or zoom-out leaves.
         * Spatial only: whether held data is still what a fetch would bring
         * back is `isCacheValid`, which the export gate reads and the scrim
         * must not, or the overlay would rise on every zoom.
         */
        get viewportWithinLoadedData() {
          const view = this.host
          return view.initialized
            ? this.trackVisibleRegions.every(block =>
                isBlockCovered(
                  self.loadedRegions.get(block.displayedRegionIndex),
                  block,
                ),
              )
            : false
        },

        /**
         * #getter
         * No content block is on screen, so there is nothing to fetch or paint;
         * see `viewportEmpty.ts`.
         */
        get viewportEmpty(): boolean {
          return viewportEmpty(this.host)
        },

        /**
         * #getter
         * Overridable hook (default false), read by the fetch plan: the display
         * draws a stand-in and wants no fetch meanwhile, as `CoarseTierMixin`
         * does while MAF's summary tier stands in. Not `fetchInert`, which also
         * drops the scrim and ends the export wait while the stand-in still
         * has to load.
         */
        get fetchSuspended(): boolean {
          return false
        },

        /**
         * #getter
         * Overridable hook (default false): a searchable feature layout exists.
         * A display with `searchFeatureByID` must override it, so callers can
         * tell "laid out, but off-display" from "no layout yet". False by
         * default so a missing override drops overlays rather than pinning
         * them to an edge.
         */
        get layoutReady(): boolean {
          return false
        },

        /**
         * #method
         * Overridable hook: whether the display can draw what this region holds
         * at the view's zoom. The default checks the stored payload against
         * its `zoomRange` where the adapter declared one
         * (`BaseFeatureDataAdapter.getZoomRange`). Override it where several
         * held payloads compete, as MAF's summary and detail tiers do. A view,
         * so its reads are dependencies of `FetchVisibleRegions`.
         */
        regionHasData(displayedRegionIndex: number): boolean {
          const payload = self.loadedRegions.get(displayedRegionIndex)?.payload
          return (
            payload !== undefined &&
            payloadServesZoom(payload, containingHost(self).bpPerPx)
          )
        },

        /**
         * #getter
         * Overridable hook (default false): the held data covers the viewport
         * but a fetch input has moved past it in a way the key cannot see, so
         * it is about to be refetched. Both the export gate (`dataCurrent`) and
         * the scrim (`displayPhase`) read it. Only an inevitable change belongs
         * here, since a true that never clears hangs the export; and never
         * restate the stamp-versus-`zoomFetchArgs` compare, which `isCacheValid`
         * already makes. Cases and rules: DISPLAY_KIT.md, "`dataSuperseded`
         * covers what `fetchInputs` cannot state".
         */
        get dataSuperseded(): boolean {
          return false
        },

        /**
         * #getter
         * The blocks the canvas draws; one displayed region may make several,
         * sharing a GPU buffer under different scissor clips. Override to
         * return [] to suppress drawing, which clears the canvas.
         */
        get renderBlocks() {
          return buildRenderBlocks(this.host.visibleRegions)
        },
      }))
      // A view, not an action, as are `zoomFetchArgs` and `regionHasData`:
      // MobX runs an action untracked, so its reads would register no
      // dependency of the `FetchVisibleRegions` autorun.
      .views(self => {
        const inputs = makeFetchInputs(self)
        return {
          /**
           * #getter
           * What a fetch issued now would stamp on a region: the settings tier
           * (`settingsFetchInputs`) and the zoom tier (`zoomFetchArgs()`).
           * `fetchRegions` captures it at issue; `isCacheValid` compares
           * against it.
           */
          get fetchInputs(): FetchInputs {
            return inputs.get()
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The store's payloads, keyed by `displayedRegionIndex`. A display
         * narrows it once (`get rpcDataMap() { return self.regionPayloads as
         * ReadonlyMap<number, MyResult> }`). The Map keeps its identity between
         * store changes only while something observes it; the render
         * lifecycle's upload autorun does for every display that draws
         * (DISPLAY_KIT.md, "A hit test's index needs an observer").
         */
        get regionPayloads(): ReadonlyMap<number, unknown> {
          return new Map(
            [...self.loadedRegions].flatMap(([idx, entry]) =>
              entry.payload === undefined ? [] : [[idx, entry.payload]],
            ),
          ) as ReadonlyMap<number, unknown>
        },

        /**
         * #getter
         * At least one region's payload is in the store. The first-paint gate
         * reads it, so a frame before any data cannot flip `canvasDrawn`.
         */
        get hasRegionData(): boolean {
          return this.regionPayloads.size > 0
        },
      }))
      .views(self => ({
        /**
         * #method
         * Whether the data held for a region still answers the current view:
         * `regionHasData`, and the region's stamp equal to `fetchInputs`. Not a
         * hook; a display states its rule through `zoomFetchArgs` and
         * `regionHasData`.
         */
        isCacheValid(displayedRegionIndex: number): boolean {
          return (
            self.regionHasData(displayedRegionIndex) &&
            isDataCurrent(
              self.loadedRegions.get(displayedRegionIndex)?.fetchInputs,
              self.fetchInputs,
            )
          )
        },
      }))
      // Own blocks, after everything they read, so siblings come off `self`:
      // a super-captured view is called bare (DISPLAY_KIT.md).
      .views(self => ({
        /**
         * #getter
         * A visible block's data was fetched under settings that have since
         * moved, and is drawn until its refetch lands: the scrim's third
         * staleness term. It compares the settings tier alone, so a zoom never
         * raises it.
         */
        get staleSettingsDrawn(): boolean {
          const { host } = self
          const settings = self.settingsFetchInputs
          return (
            host.initialized &&
            self.trackVisibleRegions.some(block => {
              const loaded = self.loadedRegions.get(block.displayedRegionIndex)
              return (
                loaded !== undefined &&
                !isDataCurrent(loaded.fetchInputs.settings, settings)
              )
            })
          )
        },
        /**
         * #getter
         * The held data is what a fetch now would bring back for every visible
         * block: covered, non-empty, `isCacheValid` per block, and not
         * `dataSuperseded`. The export gate reads it; the scrim does not take
         * `isCacheValid`, which would raise it on every zoom. It cannot latch,
         * because the planner reads the same `isCacheValid` tracked and
         * refetches any block it fails.
         */
        get dataCurrent(): boolean {
          return (
            self.viewportWithinLoadedData &&
            self.loadedRegions.size > 0 &&
            self.trackVisibleRegions.every(block =>
              self.isCacheValid(block.displayedRegionIndex),
            ) &&
            !self.dataSuperseded
          )
        },

        /**
         * #getter
         * The assembly the loaded data is on, read off the first loaded region,
         * and `undefined` until its refName aliases load: before then
         * `getCanonicalRefName2` and `refNameToIndex` answer wrongly rather than
         * throw, so the caller writes its fallback.
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
         * The loading scrim's staleness argument: spatial coverage, not
         * `dataSuperseded`, not `staleSettingsDrawn`. `displayPhase` and
         * `coarseTierDisplayPhase` both read it.
         */
        get phaseViewportCurrent(): boolean {
          return (
            self.viewportWithinLoadedData &&
            !self.dataSuperseded &&
            !self.staleSettingsDrawn
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * An SVG export can read this display's data; off-screen renderers wait
         * on it through `awaitSvgReady(model)`. See `foundationSvgReady`.
         */
        get svgReady(): boolean {
          return foundationSvgReady(self)
        },

        /**
         * #getter
         * `RenderLifecycleMixin`'s `paintInert` hook; see
         * `foundationPaintInert`. Overridable for a further inert state.
         */
        get paintInert(): boolean {
          return foundationPaintInert(self)
        },
        /**
         * #getter
         * `RenderLifecycleMixin`'s hook: `painted` reads pending over a canvas
         * drawn under the previous settings until the refetch lands.
         */
        get paintSuperseded(): boolean {
          return self.staleSettingsDrawn
        },

        /**
         * #getter
         * The display's visual state, mapped by `foundationDisplayPhase` from
         * this family's staleness argument, `phaseViewportCurrent`, passed as
         * a thunk so a display that is not loading skips the viewport reads.
         * Customize it through `fetchInert`, never by overriding it.
         */
        get displayPhase(): DisplayPhase {
          return foundationDisplayPhase(
            self,
            () => self.phaseViewportCurrent,
            () => self.host.effectiveBodyMounted,
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The raw write behind `ctx.commitRegion`, for tests staging a loaded
         * display; a fetch commits through the context, which takes no span
         * (see {@link RegionFetchContext}). It replaces the whole record, so
         * the payload is named on every call. `fetchInputs` defaults to the
         * key now, which is wrong for a caller resuming after an await.
         */
        setLoadedRegion(
          displayedRegionIndex: number,
          region: Region,
          payload: RegionPayload | undefined,
          // annotated: inferred from mid-composition `self` it would be `any`
          fetchInputs: FetchInputs = self.fetchInputs,
        ) {
          self.loadedRegions.set(displayedRegionIndex, {
            ...region,
            fetchInputs,
            payload,
          })
        },

        /**
         * #action
         * Once the store is over `MAX_STORED_REGIONS`, drop entries outside
         * `keep` (the buffered viewport), oldest first.
         */
        evictRegionStore(keep: ReadonlySet<number>) {
          let over = self.loadedRegions.size - MAX_STORED_REGIONS
          if (over <= 0) {
            return
          }
          for (const idx of [...self.loadedRegions.keys()]) {
            if (over <= 0) {
              break
            }
            if (!keep.has(idx)) {
              self.loadedRegions.delete(idx)
              over--
            }
          }
        },

        /**
         * #action
         * Forget one region, as `evictRegionStore` does past its cap. Tests
         * use it to stage an evicted region.
         */
        dropLoadedRegion(displayedRegionIndex: number) {
          self.loadedRegions.delete(displayedRegionIndex)
        },

        /**
         * #action
         * Overridable hook (no-op base): drop what this display holds beside
         * the store. Called by `clearAllRpcData`: on a displayed-regions
         * change, a viewport move past an error or cancel, and `reload()`.
         */
        clearDisplaySpecificData() {},
        /**
         * #action
         * Overridable hook (no-op base): drop what is wrong, not merely stale,
         * under a changed setting, such as a payload whose shape the setting
         * decides. Called by `invalidateSettings`; everything else stays drawn
         * under the scrim until the refetch lands (ADR-006).
         */
        clearSettingsBakedData() {},
      }))
      .actions(self => {
        const superReload = self.reload
        return {
          /**
           * #action
           * Full reset: cancel the fetch and clear the error, `loadedRegions`,
           * display-specific data and the canvas-drawn flag. The too-large
           * verdict is derived, so it needs no clear.
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
           * `SettingsInvalidate`'s reset: supersede the in-flight fetch, clear
           * a blocking error or cancel, and drop settings-baked data.
           * `loadedRegions` stays, drawn under the scrim, since every held
           * region already fails `isCacheValid` and is refetched.
           */
          invalidateSettings() {
            self.cancelFetch()
            self.setError(undefined)
            self.clearSettingsBakedData()
          },

          /**
           * #action
           * `FetchMixin.reload` plus the full reset. An override chains to it,
           * or the retry contract check goes off for that display.
           */
          reload() {
            superReload()
            this.clearAllRpcData()
          },
        }
      })
      .actions(_self => ({
        /**
         * #action
         * Overridable hook (no-op base): call one of the runners in
         * `fetchEachRegion.ts`: `fetchEachRegion` (one RPC per region),
         * `fetchAllRegions` (one per genome) or `fetchRegionsBatched` (one RPC,
         * one payload for all).
         */
        fetchNeeded(_needed: IndexedRegion[]) {},
      }))
      .actions(self => ({
        /**
         * #action
         * Fetch what `FetchVisibleRegions` would, now rather than after its
         * debounce: for a `reload()` that should not wait on a click.
         */
        fetchVisibleRegions() {
          const { host } = self
          if (host.initialized) {
            const plan = planVisibleRegionFetch(self, host)
            if (plan.kind === 'fetch') {
              self.fetchNeeded(plan.needed)
            }
          }
        },
      }))
      .actions(self => {
        const checks = makeCommitChecks(self)
        return {
          /**
           * #action
           * Run a per-region fetch, called by the runners in
           * `fetchEachRegion.ts`. `work` calls `ctx.commitRegion` as it stores
           * each payload, which marks the region loaded under the span this
           * fetch issued and the `fetchInputs` captured here at issue, never
           * re-read after the await.
           */
          async fetchRegions(
            needed: IndexedRegion[],
            work: (ctx: RegionFetchContext) => Promise<void>,
          ) {
            const fetchInputs = self.fetchInputs
            const issued = new Map(
              needed.map(n => [n.displayedRegionIndex, n.region]),
            )
            self.evictRegionStore(
              new Set(
                self.host.bufferedVisibleRegions.map(
                  b => b.displayedRegionIndex,
                ),
              ),
            )
            await self.runFetch(async ctx => {
              let committed = 0
              await work({
                ...ctx,
                commitRegion: (displayedRegionIndex, payload) => {
                  // an index this fetch did not issue has no span, so its
                  // commit is dropped and the region refetches
                  const region = issued.get(displayedRegionIndex)
                  if (region === undefined) {
                    checks.unknownRegion(displayedRegionIndex, issued.keys())
                  } else if (!ctx.isStale()) {
                    committed++
                    self.setLoadedRegion(
                      displayedRegionIndex,
                      region,
                      payload,
                      fetchInputs,
                    )
                  }
                },
              })
              // a refused batch is stale by now but still resets the
              // empty-fetch streak, which counts ungated fetches only
              if (
                needed.length > 0 &&
                (!ctx.isStale() || self.regionTooLarge)
              ) {
                checks.fetchEnded({ committed, gated: self.regionTooLarge })
              }
            })
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         * Installs the fetch-lifecycle autoruns (DisplayedRegionsChange,
         * FetchVisibleRegions, SettingsInvalidate,
         * ClearBlockingStateOnViewportChange).
         */
        afterAttach() {
          installPerRegionFetchAutoruns(
            // `clearHoveredFeature` is BaseDisplay's, which this does not compose
            self as typeof self & { clearHoveredFeature: () => void },
          )
        },
      }))
  )
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>

/**
 * The store as a mixin composed beside `MultiRegionDisplayMixin` reaches it,
 * typed off the mixin itself so a cast cannot restate either signature.
 */
export type RegionStoreSelf = Pick<
  Instance<ReturnType<typeof MultiRegionDisplayMixin>>,
  'regionPayloads' | 'setLoadedRegion'
>
