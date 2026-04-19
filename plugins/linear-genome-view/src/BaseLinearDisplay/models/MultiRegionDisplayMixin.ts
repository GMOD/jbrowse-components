import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import {
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getTrackAssemblyNames } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable, untracked } from 'mobx'

import { checkByteEstimate } from './fetchHelpers.ts'
import RegionTooLargeMixin from '../../shared/RegionTooLargeMixin.tsx'

export type { ByteEstimateConfig } from './fetchHelpers.ts'
import type { ByteEstimateConfig } from './fetchHelpers.ts'
import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface Region {
  refName: string
  start: number
  end: number
  assemblyName: string
}

export interface RegionWithNumber {
  region: Region
  regionNumber: number
}

export interface FetchContext {
  stopToken: StopToken
  generation: number
  isStale: () => boolean
}

export default function MultiRegionDisplayMixin() {
  return types
    .compose(
      'MultiRegionDisplayMixin',
      RegionTooLargeMixin(),
      GpuBackendLifecycleSlotMixin(),
      types.model({}),
    )
    .volatile(() => ({
      loadedRegions: observable.map<number, Region>(),
      error: undefined as unknown,
      renderingStopToken: undefined as StopToken | undefined,
      fetchGeneration: 0,
      statusMessage: undefined as string | undefined,
    }))
    .views(self => ({
      get isLoading() {
        return self.renderingStopToken !== undefined
      },

      get fullyDrawn() {
        return self.canvasDrawn && !this.isLoading
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
      setError(error?: unknown) {
        self.error = error
      },

      setRenderingStopToken(token: StopToken | undefined) {
        self.renderingStopToken = token
      },

      // Upload-identity contract: the GPU backend autorun re-uploads a
      // region only when its value changes. With `observable.map`, the
      // framework tracks per-key reads so an in-place `.set` is enough —
      // subclasses' per-region setters (setRpcDataForRegion etc.) should
      // follow the same in-place pattern.
      setLoadedRegionForRegion(regionNumber: number, region: Region) {
        self.loadedRegions.set(regionNumber, region)
      },

      clearDisplaySpecificData() {
        // no-op base — subclasses override to clear rpcDataMap etc.
      },
    }))
    .actions(self => ({
      clearAllRpcData() {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
          self.renderingStopToken = undefined
        }
        self.error = undefined
        self.setRegionTooLarge(false)
        self.loadedRegions.clear()
        self.fetchGeneration++
        self.clearDisplaySpecificData()
      },

      invalidateLoadedRegions() {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
          self.renderingStopToken = undefined
        }
        self.loadedRegions.clear()
        self.fetchGeneration++
      },

      bumpFetchGeneration() {
        self.fetchGeneration++
      },
    }))
    .actions(self => ({
      // Overridable hooks — subclasses override these
      onFetchNeeded(_needed: RegionWithNumber[]) {
        // no-op base
      },

      isCacheValid(_regionNumber: number) {
        return true
      },

      setStatusMessage(msg?: string) {
        self.statusMessage = msg
      },

      getByteEstimateConfig(): ByteEstimateConfig | null {
        return null
      },
    }))
    .actions(self => {
      function finishLoading() {
        self.setRenderingStopToken(undefined)
        self.setStatusMessage(undefined)
      }

      return {
        withFetchLifecycle(
          needed: RegionWithNumber[],
          work: (ctx: FetchContext) => Promise<void>,
        ) {
          if (self.renderingStopToken) {
            stopStopToken(self.renderingStopToken)
          }
          const stopToken = createStopToken()
          const generation = self.fetchGeneration
          self.setRenderingStopToken(stopToken)
          self.setError(undefined)

          const isStale = () =>
            !isAlive(self) ||
            self.fetchGeneration !== generation ||
            self.renderingStopToken !== stopToken

          const ctx: FetchContext = { stopToken, generation, isStale }

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
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
                if (isStale()) {
                  return
                }
                if (result) {
                  self.setFeatureDensityStats(result.stats)
                  if (result.tooLarge) {
                    self.setRegionTooLarge(true, result.reason)
                    finishLoading()
                    return
                  }
                }
              }
              self.setRegionTooLarge(false)
              await work(ctx)
              // Mark regions as loaded AFTER the work callback has
              // populated display-specific data (rpcDataMap, cellData,
              // etc). The GPU upload autorun tracks the plugin's own
              // data map, so by the time we record loadedRegions here,
              // the data is already committed and observable reads in
              // render autoruns see it. Displays must NOT call
              // setLoadedRegionForRegion themselves.
              if (!isStale()) {
                for (const { regionNumber, region } of needed) {
                  self.setLoadedRegionForRegion(regionNumber, region)
                }
              }
            } catch (e) {
              if (!isAbortException(e)) {
                console.error('Fetch failed:', e)
                if (!isStale()) {
                  self.setError(e)
                }
              }
            } finally {
              if (!isStale()) {
                finishLoading()

                // DO NOT REMOVE: This re-triggers the fetch autorun so it
                // re-evaluates whether the viewport is still covered after the
                // fetch completes. Without this, if the user pans while a
                // fetch is in flight, the autorun skips (isLoading=true via
                // untracked), the fetch completes covering only the old
                // viewport, and nothing triggers a second fetch for the new
                // viewport — leaving tracks half-loaded. fetchGeneration is
                // the only tracked observable we can safely bump here
                // (isLoading is intentionally untracked to avoid reaction
                // cycles).
                self.bumpFetchGeneration()
              }
            }
          })()
        },
      }
    })
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
          // by loaded data. Uses mergedVisibleRegions (exact viewport) for
          // the coverage check, and adds an explicit buffer when fetching
          // so the loaded data extends beyond the viewport for smooth
          // scrolling without blank gaps.
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                self.fetchGeneration
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
                const visibleMerged = view.mergedVisibleRegions
                for (const vr of visibleMerged) {
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
                  view.bufferedVisibleRegions.map(b => [b.regionNumber, b]),
                )
                const needed: RegionWithNumber[] = []
                for (const vr of visibleMerged) {
                  const loaded = untracked(() =>
                    self.loadedRegions.get(vr.regionNumber),
                  )
                  const boundsValid =
                    loaded?.refName === vr.refName &&
                    vr.start >= loaded.start &&
                    vr.end <= loaded.end
                  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                  if (boundsValid && self.isCacheValid(vr.regionNumber)) {
                    continue
                  }
                  const buffered = bufferedByRegion.get(vr.regionNumber)
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
                delay: 300,
              },
            ),
          )

          // SettingsInvalidate: re-fetch whenever any tracked field in
          // `rpcProps` changes. rpcProps IS the literal RPC payload, so a
          // single tracked read covers everything sent to the worker —
          // structurally impossible to add an RPC param without it being
          // the cache key. The autorun running IS the invalidation
          // signal — `clearAllRpcData` bumps fetchGeneration and empties
          // loadedRegions, which triggers FetchVisibleRegions to
          // re-fetch.
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
                for (const r of view.mergedVisibleRegions) {
                  void r.refName
                  void r.regionNumber
                }
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
