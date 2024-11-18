import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'
// jbrowse
import { getContainingView } from '@jbrowse/core/util'
import { QuantitativeStats } from '@jbrowse/core/util/stats'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
// locals
import { getQuantitativeStats } from './getQuantitativeStats'
import { createStopToken } from '@jbrowse/core/util/stopToken'

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
          console.error(e)
          if (isAlive(self)) {
            self.setError(e)
          }
        }
      },
      { delay: 1000 },
    ),
  )
}
