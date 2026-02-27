import {
  SimpleFeature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { SampleInfo, Source } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getVariantCellDataAutorun(self: {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  sources?: Source[]
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  featureDensityStatsReadyAndRegionNotTooLarge: boolean
  isMinimized: boolean
  renderingMode: string
  referenceDrawingMode: string
  cellDataMode: 'regular' | 'matrix'
  errorRetryCount: number
  setCellData: (data: unknown) => void
  setCellDataLoading: (val: boolean) => void
  setDisplayError: (e: unknown) => void
  setStatusMessage: (str?: string) => void
  setFeatures: (f: Feature[]) => void
  setHasPhased: (arg: boolean) => void
  setSampleInfo: (arg: Record<string, SampleInfo>) => void
  setSimplifiedFeaturesLoading: (arg: StopToken) => void
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
          if (
            !view.initialized ||
            !self.featureDensityStatsReadyAndRegionNotTooLarge
          ) {
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
          } = self
          if (sources) {
            self.setCellDataLoading(true)
            const sessionId = getRpcSessionId(self)
            try {
              const result = await rpcManager.call(
                sessionId,
                'MultiSampleVariantGetCellData',
                {
                  regions: view.dynamicBlocks.contentBlocks,
                  sources,
                  minorAlleleFrequencyFilter,
                  lengthCutoffFilter,
                  renderingMode,
                  referenceDrawingMode,
                  mode: cellDataMode,
                  sessionId,
                  adapterConfig,
                  stopToken,
                  statusCallback: (arg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(arg)
                    }
                  },
                },
              )
              if (isAlive(self)) {
                self.setHasPhased(result.hasPhased)
                self.setSampleInfo(result.sampleInfo)
                self.setFeatures(
                  result.simplifiedFeatures.map(f => new SimpleFeature(f)),
                )
                self.setCellData(result)
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
              console.error(e)
              self.setDisplayError(e)
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
