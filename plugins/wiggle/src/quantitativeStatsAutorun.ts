import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'
// jbrowse
import {
  isAbortException,
  getSession,
  getContainingView,
} from '@jbrowse/core/util'
import { QuantitativeStats } from '@jbrowse/core/util/stats'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnyConfigurationModel, getConf } from '@jbrowse/core/configuration'

type LGV = LinearGenomeViewModel

export function quantitativeStatsAutorun(self: {
  quantitativeStatsReady: boolean
  setLoading: (aborter: AbortController) => void
  setError: (error: unknown) => void
  updateQuantitativeStats: (
    stats: QuantitativeStats,
    statsRegion: string,
  ) => void
  adapterProps: () => Record<string, unknown>
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  autoscaleType: string
  setMessage: (str: string) => void
}) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          const aborter = new AbortController()
          const view = getContainingView(self) as LGV
          self.setLoading(aborter)

          if (!self.quantitativeStatsReady) {
            return
          }
          const statsRegion = JSON.stringify(view.dynamicBlocks)

          const wiggleStats = await getQuantitativeStats(self, {
            signal: aborter.signal,
            filters: [],
            currStatsBpPerPx: view.bpPerPx,
            ...self.adapterProps(),
          })

          if (isAlive(self)) {
            self.updateQuantitativeStats(wiggleStats, statsRegion)
          }
        } catch (e) {
          if (!isAbortException(e) && isAlive(self)) {
            console.error(e)
            self.setError(e)
          }
        }
      },
      { delay: 1000 },
    ),
  )
}

export async function getQuantitativeStats(
  self: {
    adapterConfig: AnyConfigurationModel
    configuration: AnyConfigurationModel
    autoscaleType: string
    setMessage: (str: string) => void
  },
  opts: {
    headers?: Record<string, string>
    signal?: AbortSignal
    filters: string[]
    currStatsBpPerPx: number
  },
): Promise<QuantitativeStats> {
  const { rpcManager } = getSession(self)
  const numStdDev = getConf(self, 'numStdDev') || 3
  const { adapterConfig, autoscaleType } = self
  const sessionId = getRpcSessionId(self)
  const { currStatsBpPerPx } = opts
  const params = {
    sessionId,
    adapterConfig,
    statusCallback: (message: string) => {
      if (isAlive(self)) {
        self.setMessage(message)
      }
    },
    ...opts,
  }

  if (autoscaleType === 'global' || autoscaleType === 'globalsd') {
    const results = (await rpcManager.call(
      sessionId,
      'WiggleGetGlobalQuantitativeStats',
      params,
    )) as QuantitativeStats
    const { scoreMin, scoreMean, scoreStdDev } = results
    // globalsd uses heuristic to avoid unnecessary scoreMin<0
    //
    // if the scoreMin is never less than 0 helps with most coverage bigwigs
    // just being >0
    return autoscaleType === 'globalsd'
      ? {
          ...results,
          scoreMin: scoreMin >= 0 ? 0 : scoreMean - numStdDev * scoreStdDev,
          scoreMax: scoreMean + numStdDev * scoreStdDev,
          currStatsBpPerPx,
        }
      : {
          ...results,
          currStatsBpPerPx,
        }
  }
  if (autoscaleType === 'local' || autoscaleType === 'localsd') {
    const { dynamicBlocks, bpPerPx } = getContainingView(self) as LGV
    const results = (await rpcManager.call(
      sessionId,
      'WiggleGetMultiRegionQuantitativeStats',
      {
        ...params,
        regions: dynamicBlocks.contentBlocks.map(region => {
          const { start, end } = region
          return {
            ...JSON.parse(JSON.stringify(region)),
            start: Math.floor(start),
            end: Math.ceil(end),
          }
        }),
        bpPerPx,
      },
    )) as QuantitativeStats
    const { scoreMin, scoreMean, scoreStdDev } = results

    // localsd uses heuristic to avoid unnecessary scoreMin<0 if the
    // scoreMin is never less than 0 helps with most coverage bigwigs
    // just being >0
    return autoscaleType === 'localsd'
      ? {
          ...results,
          scoreMin: scoreMin >= 0 ? 0 : scoreMean - numStdDev * scoreStdDev,
          scoreMax: scoreMean + numStdDev * scoreStdDev,
          currStatsBpPerPx,
        }
      : {
          ...results,
          currStatsBpPerPx,
        }
  }
  if (autoscaleType === 'zscale') {
    return rpcManager.call(
      sessionId,
      'WiggleGetGlobalQuantitativeStats',
      params,
    ) as Promise<QuantitativeStats>
  }
  throw new Error(`invalid autoscaleType '${autoscaleType}'`)
}
