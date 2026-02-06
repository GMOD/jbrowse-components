import {
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { Source } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
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
  setError: (error: unknown) => void
  setWebGLCellData: (data: unknown) => void
  setStatusMessage: (str: string) => void
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
            const sessionId = getRpcSessionId(self)
            const result = await rpcManager.call(
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
            )
            if (isAlive(self)) {
              self.setWebGLCellData(result)
            }
          }
        } catch (e) {
          console.error(e)
          if (!isAbortException(e) && isAlive(self)) {
            getSession(self).notifyError(`${e}`, e)
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
