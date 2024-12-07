// jbrowse
import {
  SimpleFeature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface Source {
  name: string
  color?: string
  group?: string
  [key: string]: string | undefined
}

export function getMultiVariantFeaturesAutorun(self: {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  sources?: Source[]
  mafFilter: number
  adapterProps: () => Record<string, unknown>
  setError: (error: unknown) => void
  setFeatures: (f: Feature[]) => void
  setMessage: (str: string) => void
}) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized) {
            return
          }
          const { rpcManager } = getSession(self)
          const { sources, mafFilter, adapterConfig } = self
          if (!sources) {
            return
          }
          const sessionId = getRpcSessionId(self)
          const features = (await rpcManager.call(
            sessionId,
            'MultiVariantGetSimplifiedFeatures',
            {
              regions: view.dynamicBlocks.contentBlocks,
              sources,
              mafFilter,
              sessionId,
              adapterConfig,
            },
          )) as SimpleFeatureSerialized[]
          if (isAlive(self)) {
            self.setFeatures(features.map(f => new SimpleFeature(f)))
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
