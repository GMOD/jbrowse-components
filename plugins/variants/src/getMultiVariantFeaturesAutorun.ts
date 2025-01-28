import {
  SimpleFeature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'

import type { Source } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiVariantFeaturesAutorun(self: {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  sources?: Source[]
  minorAlleleFrequencyFilter: number
  statsReadyAndRegionNotTooLarge: boolean
  adapterProps: () => Record<string, unknown>
  setError: (error: unknown) => void
  setFeatures: (f: Feature[]) => void
  setMessage: (str: string) => void
  setHasPhased: (arg: boolean) => void
  setSampleInfo: (arg: Record<string, number>) => void
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

          const { rpcManager } = getSession(self)
          const { sources, minorAlleleFrequencyFilter, adapterConfig } = self
          if (sources) {
            const sessionId = getRpcSessionId(self)
            const { sampleInfo, hasPhased, features } = (await rpcManager.call(
              sessionId,
              'MultiVariantGetSimplifiedFeatures',
              {
                regions: view.dynamicBlocks.contentBlocks,
                sources,
                minorAlleleFrequencyFilter,
                sessionId,
                adapterConfig,
              },
            )) as {
              sampleInfo: Record<string, number>
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
          if (!isAbortException(e) && isAlive(self)) {
            console.error(e)
            getSession(self).notifyError(`${e}`, e)
          }
        }
      },
      { delay: 1000 },
    ),
  )
}
