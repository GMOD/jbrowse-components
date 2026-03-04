import { createElement } from 'react'

import {
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { checkByteEstimate } from './fetchHelpers.ts'
import TooLargeMessage from '../../shared/TooLargeMessage.tsx'

export type { ByteEstimateConfig } from './fetchHelpers.ts'
import type { ByteEstimateConfig } from './fetchHelpers.ts'
import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/types'

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
      error: undefined as unknown,
      renderingStopToken: undefined as string | undefined,
      fetchGeneration: 0,
      dataVersion: 0,
      userByteSizeLimit: undefined as number | undefined,
      regionTooLargeState: false,
      regionTooLargeReasonState: '',
      featureDensityStats: undefined as FeatureDensityStats | undefined,
    }))
    .views(self => ({
      get regionTooLarge() {
        return self.regionTooLargeState
      },

      get regionTooLargeReason() {
        return self.regionTooLargeReasonState
      },

      regionCannotBeRenderedText() {
        return self.regionTooLargeState ? 'Force load to see features' : ''
      },

      regionCannotBeRendered() {
        return self.regionTooLargeState
          ? createElement(TooLargeMessage, { model: self as any })
          : null
      },
    }))
    .actions(self => ({
      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error?: unknown) {
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
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
          self.renderingStopToken = undefined
        }
        self.isLoading = false
        self.error = undefined
        self.regionTooLargeState = false
        self.regionTooLargeReasonState = ''
        self.loadedRegions = new Map()
        self.fetchGeneration++
        self.clearDisplaySpecificData()
      },
    }))
    .actions(self => ({
      // Overridable hooks — subclasses override these
      onFetchNeeded(_needed: { region: Region; regionNumber: number }[]) {
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

      setFeatureDensityStats(stats?: FeatureDensityStats) {
        self.featureDensityStats = stats
      },

      setRegionTooLarge(val: boolean, reason?: string) {
        self.regionTooLargeState = val
        self.regionTooLargeReasonState = reason ?? ''
      },

      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        if (stats?.bytes) {
          self.userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
        }
        self.regionTooLargeState = false
        self.regionTooLargeReasonState = ''
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
                  return
                }
              }
            }
            self.setRegionTooLarge(false)
            await work(ctx)
          } catch (e) {
            if (!isAbortException(e)) {
              console.warn('Fetch failed:', e)
              if (!isStale()) {
                self.setError(e)
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
                const view = getContainingView(self) as LinearGenomeViewModel
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
                const view = getContainingView(self) as LinearGenomeViewModel
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                self.fetchGeneration
                if (!view.initialized || self.error || self.regionTooLarge) {
                  return
                }

                self.beforeFetchCheck()

                const staticRegions = view.staticRegions
                const needed: { region: Region; regionNumber: number }[] = []
                for (const vr of staticRegions) {
                  const loaded = untracked(() =>
                    self.loadedRegions.get(vr.regionNumber),
                  )
                  const boundsValid =
                    loaded?.refName === vr.refName &&
                    vr.start >= loaded.start &&
                    vr.end <= loaded.end
                  if (boundsValid) {
                    continue
                  }
                  needed.push({
                    region: vr as Region,
                    regionNumber: vr.regionNumber,
                  })
                }
                const isLoading = untracked(() => self.isLoading)
                if (needed.length > 0 && !isLoading) {
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
          let prevBpPerPx: number | undefined
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                const { bpPerPx } = view
                if (
                  prevBpPerPx !== undefined &&
                  bpPerPx !== prevBpPerPx &&
                  self.regionTooLarge
                ) {
                  self.clearAllRpcData()
                }
                prevBpPerPx = bpPerPx
              },
              { name: 'ClearTooLargeOnZoom' },
            ),
          )
        },
      }
    })
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>
