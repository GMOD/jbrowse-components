import {
  SimpleFeature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  getDisplayStr,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import type { SampleInfo, Source } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getVariantCellDataAutorun(self: {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  sources?: Source[]
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  isMinimized: boolean
  renderingMode: string
  referenceDrawingMode: string
  cellDataMode: 'regular' | 'matrix'
  errorRetryCount: number
  fetchSizeLimit: number
  setCellData: (data: unknown) => void
  setCellDataLoading: (val: boolean) => void
  setDisplayError: (e: unknown) => void
  setStatusMessage: (str?: string) => void
  setFeatures: (f: Feature[]) => void
  setHasPhased: (arg: boolean) => void
  setSampleInfo: (arg: Record<string, SampleInfo>) => void
  setSimplifiedFeaturesLoading: (arg: StopToken) => void
  setRegionTooLarge: (val: boolean, reason?: string) => void
  setFeatureDensityStats: (stats?: FeatureDensityStats) => void
}) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          if (!isAlive(self) || self.isMinimized) {
            return
          }
          void self.errorRetryCount
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized) {
            return
          }

          const stopToken = createStopToken()
          self.setSimplifiedFeaturesLoading(stopToken)
          const { rpcManager } = getSession(self)
          const {
            lengthCutoffFilter,
            sources,
            minorAlleleFrequencyFilter,
            adapterConfig,
            renderingMode,
            referenceDrawingMode,
            cellDataMode,
            fetchSizeLimit,
          } = self
          const visibleBp = view.dynamicBlocks.contentBlocks.reduce(
            (acc, b) => acc + b.end - b.start,
            0,
          )
          if (sources) {
            self.setCellDataLoading(true)
            const sessionId = getRpcSessionId(self)
            try {
              const result = await rpcManager.call(
                sessionId,
                'MultiSampleVariantGetCellData',
                {
                  regions: view.dynamicBlocks.contentBlocks,
                  regionNumbers: view.dynamicBlocks.contentBlocks.map(b => {
                    if (b.regionNumber === undefined) {
                      throw new Error(
                        `Content block for ${b.refName} has no regionNumber`,
                      )
                    }
                    return b.regionNumber
                  }),
                  sources,
                  minorAlleleFrequencyFilter,
                  lengthCutoffFilter,
                  renderingMode,
                  referenceDrawingMode,
                  mode: cellDataMode,
                  sessionId,
                  adapterConfig,
                  stopToken,
                  // Regions smaller than AUTO_FORCE_LOAD_BP always
                  // load unconditionally. For larger regions, send
                  // the byte size limit so the RPC can check the
                  // adapter index estimate before fetching features.
                  byteSizeLimit:
                    visibleBp >= AUTO_FORCE_LOAD_BP
                      ? fetchSizeLimit
                      : undefined,
                  statusCallback: (arg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(arg)
                    }
                  },
                },
              )
              if (isAlive(self)) {
                if ('regionTooLarge' in result) {
                  self.setFeatureDensityStats({
                    bytes: result.bytes,
                    fetchSizeLimit: result.fetchSizeLimit,
                  })
                  self.setRegionTooLarge(
                    true,
                    `Requested too much data (${getDisplayStr(result.bytes)})`,
                  )
                } else {
                  self.setRegionTooLarge(false, '')
                  self.setHasPhased(result.hasPhased)
                  self.setSampleInfo(result.sampleInfo)
                  self.setFeatures(
                    result.simplifiedFeatures.map(f => new SimpleFeature(f)),
                  )
                  self.setCellData(result)
                }
              }
            } finally {
              if (isAlive(self)) {
                self.setCellDataLoading(false)
                self.setStatusMessage(undefined)
              }
            }
          }
        } catch (e) {
          if (isAlive(self)) {
            self.setCellDataLoading(false)
            if (!isAbortException(e)) {
              console.error('[VariantCellData] error', e)
              self.setDisplayError(e)
            } else {
              console.log('[VariantCellData] aborted')
            }
          }
        }
      },
      {
        delay: 1000,
        name: 'VariantCellData',
      },
    ),
  )
}
