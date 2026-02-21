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
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getWebGLVariantCellDataAutorun(self: {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  sources?: Source[]
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  featureDensityStatsReadyAndRegionNotTooLarge: boolean
  isMinimized: boolean
  renderingMode: string
  referenceDrawingMode: string
  webglCellDataMode: 'regular' | 'matrix'
  setWebGLCellData: (data: unknown) => void
  setWebGLCellDataLoading: (val: boolean) => void
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
            webglCellDataMode,
          } = self
          if (sources) {
            self.setWebGLCellDataLoading(true)
            const sessionId = getRpcSessionId(self)
            try {
              const result = (await rpcManager.call(
                sessionId,
                'MultiVariantGetWebGLCellData',
                {
                  regions: view.dynamicBlocks.contentBlocks,
                  sources,
                  minorAlleleFrequencyFilter,
                  lengthCutoffFilter,
                  renderingMode,
                  referenceDrawingMode,
                  mode: webglCellDataMode,
                  sessionId,
                  adapterConfig,
                  stopToken,
                  statusCallback: (arg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(arg)
                    }
                  },
                },
              )) as {
                sampleInfo: Record<string, SampleInfo>
                hasPhased: boolean
                simplifiedFeatures: SimpleFeatureSerialized[]
              }
              if (isAlive(self)) {
                self.setHasPhased(result.hasPhased)
                self.setSampleInfo(result.sampleInfo)
                self.setFeatures(
                  result.simplifiedFeatures.map(f => new SimpleFeature(f)),
                )
                self.setWebGLCellData(result)
              }
            } finally {
              if (isAlive(self)) {
                self.setWebGLCellDataLoading(false)
                self.setStatusMessage(undefined)
              }
            }
          }
        } catch (e) {
          if (isAlive(self)) {
            self.setWebGLCellDataLoading(false)
            if (!isAbortException(e)) {
              getSession(self).notifyError(`${e}`, e)
            }
          }
        }
      },
      {
        delay: 1000,
        name: 'WebGLVariantCellData',
      },
    ),
  )
}
