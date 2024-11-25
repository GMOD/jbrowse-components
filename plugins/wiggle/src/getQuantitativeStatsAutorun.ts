import { getContainingView, isAbortException } from '@jbrowse/core/util'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'
// jbrowse
import { getQuantitativeStats } from './getQuantitativeStats'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { QuantitativeStats } from '@jbrowse/core/util/stats'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
// locals

type LGV = LinearGenomeViewModel

export function getQuantitativeStatsAutorun(self: {
  quantitativeStatsReady: boolean
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  autoscaleType: string
  adapterProps: () => Record<string, unknown>
  setStatsLoading: (token: string) => void
  setError: (error: unknown) => void
  setMessage: (str: string) => void
  updateQuantitativeStats: (stats: QuantitativeStats, region: string) => void
}) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          if (self.quantitativeStatsReady) {
            const view = getContainingView(self) as LGV
            const stopToken = createStopToken()
            self.setStatsLoading(stopToken)
            const statsRegion = JSON.stringify(view.dynamicBlocks)
            const wiggleStats = await getQuantitativeStats(self, {
              stopToken,
              filters: [],
              currStatsBpPerPx: view.bpPerPx,
              ...self.adapterProps(),
            })

            if (isAlive(self)) {
              self.updateQuantitativeStats(wiggleStats, statsRegion)
            }
          }
        } catch (e) {
          if (isAlive(self) && !isAbortException(e)) {
            console.error(e)
            self.setError(e)
          }
        }
      },
      { delay: 1000 },
    ),
  )
}
