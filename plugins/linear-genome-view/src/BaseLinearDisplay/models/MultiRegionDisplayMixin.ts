import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
  measureText,
} from '@jbrowse/core/util'
import {
  createStopToken,
  stopStopToken,
} from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { checkByteEstimate } from './fetchHelpers.ts'

import type { ByteEstimateConfig } from './fetchHelpers.ts'
import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'

export interface Region {
  refName: string
  start: number
  end: number
  assemblyName: string
}

export interface FetchContext {
  stopToken: string
  generation: number
  isStale: () => boolean
}

export default function MultiRegionDisplayMixin() {
  return types
    .model('MultiRegionDisplayMixin', {})
    .volatile(() => ({
      loadedRegions: new Map<number, Region>(),
      isLoading: false,
      error: null as Error | null,
      renderingStopToken: undefined as string | undefined,
      fetchGeneration: 0,
      dataVersion: 0,
    }))
    .views(self => ({
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },
    }))
    .actions(self => ({
      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        self.error = error
      },

      setRenderingStopToken(token: string | undefined) {
        self.renderingStopToken = token
      },

      setLoadedRegionForRegion(regionNumber: number, region: Region) {
        const next = new Map(self.loadedRegions)
        next.set(regionNumber, region)
        self.loadedRegions = next
        self.dataVersion++
      },

      clearDisplaySpecificData() {
        // no-op base — subclasses override to clear rpcDataMap etc.
      },
    }))
    .actions(self => ({
      clearAllRpcData() {
        console.debug('[MultiRegionDisplayMixin] clearAllRpcData called', {
          hadToken: !!self.renderingStopToken,
          wasLoading: self.isLoading,
          hadError: !!self.error,
          fetchGeneration: self.fetchGeneration,
        })
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
          self.renderingStopToken = undefined
        }
        self.isLoading = false
        self.error = null
        self.loadedRegions = new Map()
        self.fetchGeneration++
        self.clearDisplaySpecificData()
      },
    }))
    .actions(() => ({
      // Overridable hooks — subclasses override these
      onFetchNeeded(
        _needed: { region: Region; regionNumber: number }[],
      ) {
        // no-op base
      },

      isCacheValid(_regionNumber: number) {
        return true
      },

      beforeFetchCheck() {
        // no-op base
      },

      setStatusMessage(_msg?: string) {
        // no-op base — subclasses override (e.g. NonBlockCanvasDisplayMixin)
      },

      setFeatureDensityStats(_stats?: { bytes?: number; fetchSizeLimit?: number }) {
        // no-op base — RegionTooLargeMixin overrides
      },

      setRegionTooLarge(_val: boolean, _reason?: string) {
        // no-op base — RegionTooLargeMixin overrides
      },

      getByteEstimateConfig(): ByteEstimateConfig | null {
        return null
      },
    }))
    .actions(self => ({
      withFetchLifecycle(
        needed: { region: Region; regionNumber: number }[],
        work: (ctx: FetchContext) => Promise<void>,
      ) {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
        }
        const stopToken = createStopToken()
        const generation = self.fetchGeneration
        self.setRenderingStopToken(stopToken)
        self.setLoading(true)
        self.setError(null)

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
                  return
                }
              }
            }
            self.setRegionTooLarge(false)
            await work(ctx)
          } catch (e) {
            if (!isAbortException(e)) {
              console.error('Fetch failed:', e)
              if (!isStale()) {
                self.setError(
                  e instanceof Error ? e : new Error(String(e)),
                )
              }
            }
          } finally {
            if (!isStale()) {
              self.setRenderingStopToken(undefined)
              self.setLoading(false)
              self.setStatusMessage(undefined)
            }
          }
        })()
      },
    }))
    .actions(self => {
      let prevDisplayedRegionsStr = ''
      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(
                  self,
                ) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                const regionStr = JSON.stringify(
                  view.displayedRegions.map(r => ({
                    refName: r.refName,
                    start: r.start,
                    end: r.end,
                  })),
                )
                if (
                  prevDisplayedRegionsStr !== '' &&
                  regionStr !== prevDisplayedRegionsStr
                ) {
                  console.debug(
                    '[MultiRegionDisplayMixin] DisplayedRegionsChange → clearAllRpcData',
                  )
                  self.clearAllRpcData()
                }
                prevDisplayedRegionsStr = regionStr
              },
              { name: 'DisplayedRegionsChange' },
            ),
          )

          // Autorun: fetch data for all visible regions
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(
                  self,
                ) as LinearGenomeViewModel
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                self.fetchGeneration
                if (!view.initialized || self.error) {
                  return
                }
                // Runtime check for optional RegionTooLargeMixin
                if (
                  'regionTooLarge' in self &&
                  (self as unknown as { regionTooLarge: boolean })
                    .regionTooLarge
                ) {
                  return
                }

                self.beforeFetchCheck()

                const staticRegions = view.staticRegions
                const needed: { region: Region; regionNumber: number }[] =
                  []
                for (const vr of staticRegions) {
                  const loaded = untracked(() =>
                    self.loadedRegions.get(vr.regionNumber),
                  )
                  const boundsValid =
                    loaded?.refName === vr.refName &&
                    vr.start >= loaded.start &&
                    vr.end <= loaded.end
                  if (
                    boundsValid &&
                    untracked(() => self.isCacheValid(vr.regionNumber))
                  ) {
                    continue
                  }
                  needed.push({
                    region: vr as Region,
                    regionNumber: vr.regionNumber,
                  })
                }
                if (
                  needed.length > 0 &&
                  !untracked(() => self.isLoading)
                ) {
                  self.onFetchNeeded(needed)
                }
              },
              {
                name: 'FetchVisibleRegions',
                delay: 300,
              },
            ),
          )

          // Autorun: when zoom changes while regionTooLarge is set, clear
          // so the fetch autorun retries with the new (smaller) region
          if ('regionTooLarge' in self) {
            let prevBpPerPx: number | undefined
            addDisposer(
              self,
              autorun(
                () => {
                  const view = getContainingView(
                    self,
                  ) as LinearGenomeViewModel
                  const { bpPerPx } = view
                  if (
                    prevBpPerPx !== undefined &&
                    bpPerPx !== prevBpPerPx &&
                    (self as unknown as { regionTooLarge: boolean })
                      .regionTooLarge
                  ) {
                    console.debug(
                      '[MultiRegionDisplayMixin] ClearTooLargeOnZoom → clearAllRpcData',
                      { prevBpPerPx, bpPerPx },
                    )
                    self.clearAllRpcData()
                  }
                  prevBpPerPx = bpPerPx
                },
                { name: 'ClearTooLargeOnZoom' },
              ),
            )
          }
        },
      }
    })
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>
