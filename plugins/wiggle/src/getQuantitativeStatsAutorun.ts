import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'
// jbrowse
import { isAbortException, getContainingView } from '@jbrowse/core/util'
import { QuantitativeStats } from '@jbrowse/core/util/stats'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
// locals
import { getQuantitativeStats } from './getQuantitativeStats'

type LGV = LinearGenomeViewModel

export function getQuantitativeStatsAutorun(self: {
  quantitativeStatsReady: boolean
  quantitativeStatsUpToDate: boolean
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  autoscaleType: string
  adapterProps: () => Record<string, unknown>
  setStatsLoading: (aborter: AbortController) => void
  setError: (error: unknown) => void
  setMessage: (str: string) => void
  updateQuantitativeStats: (stats: QuantitativeStats, region: string) => void
}) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          const view = getContainingView(self) as LGV
          const aborter = new AbortController()
          self.setStatsLoading(aborter)
          if (!self.quantitativeStatsReady) {
            return
          }
          if (self.quantitativeStatsUpToDate) {
            return
          }

          const statsRegions = JSON.stringify(view.dynamicBlocks)
          const wiggleStats = await getQuantitativeStats(self, {
            signal: aborter.signal,
            filters: [],
            currStatsBpPerPx: view.bpPerPx,
            currStatsRegions: statsRegions,
            ...self.adapterProps(),
          })

          if (isAlive(self)) {
            self.updateQuantitativeStats(wiggleStats, statsRegions)
          }
        } catch (e) {
          console.error(e)
          if (!isAbortException(e) && isAlive(self)) {
            self.setError(e)
          }
        }
      },
      { delay: 1000 },
    ),
  )
}
