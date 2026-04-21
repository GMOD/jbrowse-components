import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import {
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { getTrackAssemblyNames } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable, untracked } from 'mobx'

import FetchMixin from './FetchMixin.ts'
import { checkByteEstimate } from './fetchHelpers.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

export type { ByteEstimateConfig } from './fetchHelpers.ts'
export type { FetchContext } from './FetchMixin.ts'
import type { FetchContext } from './FetchMixin.ts'
import type { ByteEstimateConfig } from './fetchHelpers.ts'
import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { Region } from '@jbrowse/core/util'

export default function MultiRegionDisplayMixin() {
  return types
    .compose(
      'MultiRegionDisplayMixin',
      RegionTooLargeMixin(),
      GpuBackendLifecycleSlotMixin(),
      FetchMixin(),
      types.model({}),
    )
    .volatile(() => ({
      loadedRegions: observable.map<number, Region>(),
    }))
    .views(self => ({
      get fullyDrawn() {
        return self.canvasDrawn && !self.isLoading
      },

      // Shared cached view for every LGV-based GPU display. A single
      // displayedRegion may produce multiple render blocks (shared GPU
      // buffer, different scissor clips on screen). Plugins that want to
      // suppress rendering in certain states (e.g. no domain yet) can
      // override this getter to return [] — the autorun lifecycle will
      // then issue an empty-blocks render that clears the canvas.
      get renderBlocks() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return buildRenderBlocks(view.visibleRegions)
      },

      // Default: subclasses override to return the literal RPC payload.
      // The mixin's afterAttach installs an autorun that reads this
      // getter — any change to the fields it reads clears all loaded
      // data, letting FetchVisibleRegions re-fetch. Subclasses that do
      // not refetch via FetchVisibleRegions (HiC, LD, variants) can
      // still define `rpcProps` for documentation and consumer use,
      // but they don't benefit from this mixin-owned invalidation.
      get rpcProps(): Record<string, unknown> | undefined {
        return undefined
      },
    }))
    .actions(self => ({
      // Upload-identity contract: the GPU backend autorun re-uploads a
      // region only when its value changes. With `observable.map`, the
      // framework tracks per-key reads so an in-place `.set` is enough —
      // subclasses' per-region setters (setRpcData etc.) should
      // follow the same in-place pattern.
      setLoadedRegion(displayedRegionIndex: number, region: Region) {
        self.loadedRegions.set(displayedRegionIndex, region)
      },

      clearDisplaySpecificData() {
        // no-op base — subclasses override to clear rpcDataMap etc.
      },
    }))
    .actions(self => ({
      clearAllRpcData() {
        self.cancelFetch()
        self.setError(undefined)
        self.setRegionTooLarge(false)
        self.loadedRegions.clear()
        self.clearDisplaySpecificData()
        self.resetCanvasDrawn()
      },

      invalidateLoadedRegions() {
        self.cancelFetch()
        self.loadedRegions.clear()
      },
    }))
    .actions(_self => ({
      // Overridable hooks — subclasses override these
      onFetchNeeded(
        _needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        // no-op base
      },

      isCacheValid(_displayedRegionIndex: number): boolean {
        // can be overridden by derived classes
        return true
      },

      getByteEstimateConfig(): ByteEstimateConfig | null {
        return null
      },
    }))
    .actions(self => ({
      // Run a per-region fetch with byte-estimate gating. Marks regions
      // as loaded only AFTER the work callback has populated display-
      // specific data (rpcDataMap, cellData, etc) so the GPU upload
      // autorun sees committed data when it observes loadedRegions.
      // Displays must NOT call setLoadedRegion themselves.
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
    .actions(self => {
      return {
        afterAttach() {
          // Clear loaded data whenever the displayed-regions list
          // changes. Tracks refName/start/end of every entry; MobX
          // re-fires on any change. Fires once at mount as a harmless
          // no-op (nothing loaded yet).
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                for (const r of view.displayedRegions) {
                  void r.refName
                  void r.start
                  void r.end
                }
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
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                self.fetchSignal
                if (!view.initialized || self.error || self.regionTooLarge) {
                  return
                }

                // Check isLoading without tracking it as a MobX dependency
                // to prevent a reaction cycle (isLoading changes -> autorun
                // re-fires -> checks isLoading again). We only need this as
                // a guard against concurrent fetches, not as a trigger.
                if (untracked(() => self.isLoading)) {
                  return
                }

                const { assemblyManager } = getSession(self)
                const trackAssemblyNames = getTrackAssemblyNames(
                  getContainingTrack(self),
                )
                const visibleBlocks = view.visibleRegions
                for (const vr of visibleBlocks) {
                  const regionAsm = vr.assemblyName
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

                const bufferedByRegion = new Map(
                  view.bufferedVisibleRegions.map(b => [
                    b.displayedRegionIndex,
                    b,
                  ]),
                )
                const needed: {
                  region: Region
                  displayedRegionIndex: number
                }[] = []
                for (const vr of visibleBlocks) {
                  const loaded = untracked(() =>
                    self.loadedRegions.get(vr.displayedRegionIndex),
                  )
                  const boundsValid =
                    loaded?.refName === vr.refName &&
                    Math.floor(vr.start) >= loaded.start &&
                    Math.ceil(vr.end) <= loaded.end

                  if (
                    boundsValid &&
                    self.isCacheValid(vr.displayedRegionIndex)
                  ) {
                    continue
                  }
                  const buffered = bufferedByRegion.get(vr.displayedRegionIndex)
                  if (buffered) {
                    needed.push(buffered)
                  }
                }
                if (needed.length > 0) {
                  self.onFetchNeeded(needed)
                }
              },
              {
                name: 'FetchVisibleRegions',
                delay: 600,
              },
            ),
          )

          // SettingsInvalidate: re-fetch whenever any tracked field in
          // `rpcProps` changes. rpcProps IS the literal RPC payload, so a
          // single tracked read covers everything sent to the worker —
          // structurally impossible to add an RPC param without it being
          // the cache key. The autorun running IS the invalidation
          // signal — `clearAllRpcData` cancels the in-flight fetch (which
          // bumps fetchSignal) and empties loadedRegions, which triggers
          // FetchVisibleRegions to re-fetch.
          //
          // Subclasses that don't override `rpcProps` get an autorun
          // with no tracked reads — it fires once at setup (mobx init
          // behavior) on empty data, a harmless no-op.
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                void self.rpcProps
                self.clearAllRpcData()
              },
              { name: 'SettingsInvalidate' },
            ),
          )

          // When zoom or viewport position changes while regionTooLarge
          // or error is set, clear so the fetch autorun retries. Reads
          // error/regionTooLarge untracked so setting them doesn't
          // trigger this autorun to immediately wipe them — only the
          // viewport read should fire it.
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                void view.bpPerPx
                void view.visibleRegions
                if (untracked(() => self.regionTooLarge || self.error)) {
                  self.clearAllRpcData()
                }
              },
              { name: 'ClearBlockingStateOnViewportChange' },
            ),
          )
        },
      }
    })
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>
