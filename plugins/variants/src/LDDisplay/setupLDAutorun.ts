import { getContainingView, getSession } from '@jbrowse/core/util'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { autorun } from 'mobx'
import { isAlive } from 'mobx-state-tree'

import type { LDDisplayModel } from './model.ts'
import type { LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function setupLDAutorun(self: LDDisplayModel) {
  autorun(
    async () => {
      try {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || view.bpPerPx > 1000) {
          // Don't compute LD when zoomed out too far
          return
        }
        const { dynamicBlocks, bpPerPx } = view
        const regions = dynamicBlocks.contentBlocks

        if (!regions.length) {
          return
        }

        const stopToken = createStopToken()
        self.setLDDataLoading(stopToken)

        const session = getSession(self)
        const { rpcManager } = session

        const result = (await rpcManager.call(
          session.id,
          'MultiVariantGetLDMatrix',
          {
            regions: regions.map(r => ({
              ...r,
              refName: view.assemblyManager.get(r.assemblyName)?.getCanonicalRefName(r.refName) ?? r.refName,
            })),
            adapterConfig: self.adapterConfig,
            sessionId: session.id,
            bpPerPx,
            minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
            lengthCutoffFilter: self.lengthCutoffFilter,
            stopToken,
          },
        )) as LDMatrixResult

        if (isAlive(self)) {
          self.setLDData(result)
        }
      } catch (e) {
        if (isAlive(self)) {
          if (!`${e}`.includes('AbortError')) {
            console.error(e)
            self.setError(e as Error)
          }
        }
      }
    },
    { delay: 500 },
  )
}
