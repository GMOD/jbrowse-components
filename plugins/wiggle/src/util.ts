import { scaleLinear, scaleLog, scaleQuantize } from 'd3-scale'

export interface ScaleOpts {
  domain: number[]
  range: number[]
  scaleType: string
  pivotValue?: number
  inverted: boolean
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
  // console.log('before', scale.domain())
  scale.nice()

  const [rangeMin, rangeMax] = range
  if (rangeMin === undefined || rangeMax === undefined) {
    throw new Error('invalid range')
  }
  scale.range(inverted ? range.slice().reverse() : range)

  // console.log('after', scale.domain())
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
  domain: number[]
  bounds: number[]
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
    throw new Error('invalid domain')
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
