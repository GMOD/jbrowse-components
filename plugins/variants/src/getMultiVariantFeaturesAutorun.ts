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

import type { SampleInfo, Source } from './shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiVariantFeaturesAutorun(self: {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  sources?: Source[]
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  statsReadyAndRegionNotTooLarge: boolean
  adapterProps: () => Record<string, unknown>
  setError: (error: unknown) => void
  setFeatures: (f: Feature[]) => void
  setMessage: (str: string) => void
  setHasPhased: (arg: boolean) => void
  setSampleInfo: (arg: Record<string, SampleInfo>) => void
  setSimplifiedFeaturesLoading: (arg: string) => void
}) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized || !self.statsReadyAndRegionNotTooLarge) {
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
          } = self
          if (sources) {
            const sessionId = getRpcSessionId(self)
            const { sampleInfo, hasPhased, features } = (await rpcManager.call(
              sessionId,
              'MultiVariantGetSimplifiedFeatures',
              {
                regions: view.dynamicBlocks.contentBlocks,
                sources,
                minorAlleleFrequencyFilter,
                lengthCutoffFilter,
                sessionId,
                adapterConfig,
                stopToken,
              },
            )) as {
              sampleInfo: Record<string, SampleInfo>
              hasPhased: boolean
              features: SimpleFeatureSerialized[]
            }
            if (isAlive(self)) {
              self.setHasPhased(hasPhased)
              self.setSampleInfo(sampleInfo)
              self.setFeatures(features.map(f => new SimpleFeature(f)))
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
      },
    ),
  )
}
