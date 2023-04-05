import { scaleLinear, scaleLog, scaleQuantize } from 'd3-scale'
import { autorun } from 'mobx'
import {
  isAbortException,
  getSession,
  getContainingView,
} from '@jbrowse/core/util'
import { FeatureStats } from '@jbrowse/core/util/stats'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from 'mobx-state-tree'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnyConfigurationModel, getConf } from '@jbrowse/core/configuration'

type LGV = LinearGenomeViewModel

export const YSCALEBAR_LABEL_OFFSET = 5

export interface ScaleOpts {
  domain: number[]
  range: number[]
  scaleType: string
  pivotValue?: number
  inverted?: boolean
}

export interface Source {
  name: string
  color?: string
  group?: string
}

/**
 * produces a d3-scale from arguments. applies a "nice domain" adjustment
 *
 * @param object - containing attributes
 *   - domain [min,max]
 *   - range [min,max]
 *   - bounds [min,max]
 *   - scaleType (linear or log)
 *   - pivotValue (number)
 *   - inverted (boolean)
 */
export function getScale({
  domain = [],
  range = [],
  scaleType,
  pivotValue,
  inverted,
}: ScaleOpts) {
  let scale
  const [min, max] = domain
  if (min === undefined || max === undefined) {
    throw new Error('invalid domain')
  }
  if (scaleType === 'linear') {
    scale = scaleLinear()
  } else if (scaleType === 'log') {
    scale = scaleLog()
    scale.base(2)
  } else if (scaleType === 'quantize') {
    scale = scaleQuantize()
  } else {
    throw new Error('undefined scaleType')
  }
  scale.domain(pivotValue !== undefined ? [min, pivotValue, max] : [min, max])
  scale.nice()

  const [rangeMin, rangeMax] = range
  if (rangeMin === undefined || rangeMax === undefined) {
    throw new Error('invalid range')
  }
  scale.range(inverted ? range.slice().reverse() : range)
  return scale
}
/**
 * gets the origin for drawing the graph. for linear this is 0, for log this is arbitrarily set to log(1)==0
 *
 * @param scaleType -
 */
export function getOrigin(scaleType: string /* , pivot, stats */) {
  // if (pivot) {
  //   if (pivot === 'mean') {
  //     return stats.scoreMean || 0
  //   }
  //   if (pivot === 'zero') {
  //     return 0
  //   }
  //   return parseFloat()
  // }
  // if (scaleType === 'z_score') {
  //   return stats.scoreMean || 0
  // }
  if (scaleType === 'log') {
    return 1
  }
  return 0
}

/**
 * produces a "nice" domain that actually rounds down to 0 for the min
 * or 0 to the max depending on if all values are positive or negative
 *
 * @param object - containing attributes
 *   - domain [min,max]
 *   - bounds [min,max]
 *   - mean
 *   - stddev
 *   - scaleType (linear or log)
 */
export function getNiceDomain({
  scaleType,
  domain,
  bounds,
}: {
  scaleType: string
  domain: readonly [number, number]
  bounds: readonly [number | undefined, number | undefined]
}) {
  const [minScore, maxScore] = bounds
  let [min, max] = domain

  if (scaleType === 'linear') {
    if (max < 0) {
      max = 0
    }
    if (min > 0) {
      min = 0
    }
  }
  if (scaleType === 'log') {
    // if the min is 0, assume that it's just something
    // with no read coverage and that we should ignore it in calculations
    // if it's greater than 1 pin to 1 for the full range also
    // otherwise, we may see bigwigs with fractional values
    if (min === 0 || min > 1) {
      min = 1
    }
  }
  if (min === undefined || max === undefined) {
    throw new Error('invalid domain supplied to stats function')
  }
  if (minScore !== undefined && minScore !== Number.MIN_VALUE) {
    min = minScore
  }
  if (maxScore !== undefined && maxScore !== Number.MAX_VALUE) {
    max = maxScore
  }
  const getScaleType = (type: string) => {
    if (type === 'linear') {
      return scaleLinear()
    }
    if (type === 'log') {
      const scale = scaleLog()
      scale.base(2)
      return scale
    }
    if (type === 'quantize') {
      return scaleQuantize()
    }
    throw new Error(`undefined scaleType ${type}`)
  }
  const scale = getScaleType(scaleType)

  scale.domain([min, max])
  scale.nice()
  return scale.domain() as [number, number]
}

export function groupBy<T>(array: T[], predicate: (v: T) => string) {
  const result = {} as { [key: string]: T[] }
  for (const value of array) {
    const entry = (result[predicate(value)] ||= [])
    entry.push(value)
  }
  return result
}

export async function getStats(
  self: {
    adapterConfig: AnyConfigurationModel
    autoscaleType: string
    setMessage: (str: string) => void
  },
  opts: {
    headers?: Record<string, string>
    signal?: AbortSignal
    filters?: string[]
  },
): Promise<FeatureStats> {
  const { rpcManager } = getSession(self)
  const nd = getConf(self, 'numStdDev') || 3
  const { adapterConfig, autoscaleType } = self
  const sessionId = getRpcSessionId(self)
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
    const results: FeatureStats = (await rpcManager.call(
      sessionId,
      'WiggleGetGlobalStats',
      params,
    )) as FeatureStats
    const { scoreMin, scoreMean, scoreStdDev } = results
    // globalsd uses heuristic to avoid unnecessary scoreMin<0
    // if the scoreMin is never less than 0
    // helps with most coverage bigwigs just being >0
    return autoscaleType === 'globalsd'
      ? {
          ...results,
          scoreMin: scoreMin >= 0 ? 0 : scoreMean - nd * scoreStdDev,
          scoreMax: scoreMean + nd * scoreStdDev,
        }
      : results
  }
  if (autoscaleType === 'local' || autoscaleType === 'localsd') {
    const { dynamicBlocks, bpPerPx } = getContainingView(self) as LGV
    const results = (await rpcManager.call(
      sessionId,
      'WiggleGetMultiRegionStats',
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
    )) as FeatureStats
    const { scoreMin, scoreMean, scoreStdDev } = results

    // localsd uses heuristic to avoid unnecessary scoreMin<0 if the
    // scoreMin is never less than 0 helps with most coverage bigwigs
    // just being >0
    return autoscaleType === 'localsd'
      ? {
          ...results,
          scoreMin: scoreMin >= 0 ? 0 : scoreMean - nd * scoreStdDev,
          scoreMax: scoreMean + nd * scoreStdDev,
        }
      : results
  }
  if (autoscaleType === 'zscale') {
    return rpcManager.call(
      sessionId,
      'WiggleGetGlobalStats',
      params,
    ) as Promise<FeatureStats>
  }
  throw new Error(`invalid autoscaleType '${autoscaleType}'`)
}

export function statsAutorun(self: {
  estimatedStatsReady: boolean
  regionTooLarge: boolean
  setLoading: (aborter: AbortController) => void
  setError: (error: unknown) => void
  updateStats: (stats: FeatureStats, statsRegion: string) => void
  renderProps: () => Record<string, unknown>
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

          if (
            !view.initialized ||
            !self.estimatedStatsReady ||
            self.regionTooLarge
          ) {
            return
          }
          const statsRegion = JSON.stringify(view.dynamicBlocks)

          const wiggleStats = await getStats(self, {
            signal: aborter.signal,
            ...self.renderProps(),
          })

          if (isAlive(self)) {
            self.updateStats(wiggleStats, statsRegion)
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

export function toP(s = 0) {
  return +(+s).toPrecision(6)
}

export function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}
