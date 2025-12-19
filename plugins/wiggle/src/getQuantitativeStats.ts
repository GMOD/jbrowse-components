import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { QuantitativeStats } from '@jbrowse/core/util/stats'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function getQuantitativeStats(
  self: {
    adapterConfig: AnyConfigurationModel
    configuration: AnyConfigurationModel
    autoscaleType: string
    setStatusMessage: (str: string) => void
    effectiveRpcDriverName?: string
  },
  opts: {
    headers?: Record<string, string>
    stopToken?: StopToken
    filters: string[]
    currStatsBpPerPx: number
  },
): Promise<QuantitativeStats> {
  const { rpcManager } = getSession(self)
  const numStdDev = getConf(self, 'numStdDev') || 3
  const { adapterConfig, autoscaleType, effectiveRpcDriverName } = self
  const sessionId = getRpcSessionId(self)
  const statsId = getContainingTrack(self).id
  const { currStatsBpPerPx } = opts
  const params = {
    sessionId,
    statsId,
    adapterConfig,
    rpcDriverName: effectiveRpcDriverName,
    statusCallback: (message: string) => {
      if (isAlive(self)) {
        self.setStatusMessage(message)
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
  } else if (autoscaleType === 'local' || autoscaleType === 'localsd') {
    const { dynamicBlocks, staticBlocks, bpPerPx } = getContainingView(
      self,
    ) as LGV
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
        staticBlocks: staticBlocks.contentBlocks.map(region => {
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

    // uses heuristic to avoid unnecessary scoreMin<0 if the scoreMin is never
    // less than 0 helps with most coverage bigwigs just being >0
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
  } else if (autoscaleType === 'zscale') {
    return rpcManager.call(
      sessionId,
      'WiggleGetGlobalQuantitativeStats',
      params,
    ) as Promise<QuantitativeStats>
  }
  throw new Error(`invalid autoscaleType '${autoscaleType}'`)
}
