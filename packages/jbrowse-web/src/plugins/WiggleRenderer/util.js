import { scaleLinear, scaleLog, scaleQuantize } from 'd3-scale'

/**
 * produces a d3-scale from arguments. applies a "nice domain" adjustment
 *
 * @param {strig} scaleType string specifying linear, log or quantize
 * @param {array} domain array containing min/max for domain
 * @param {array} range array containing min/max for range
 * @param {object} opts object which can have minScore, maxScore, pivotValue, and inverted
 */
export function getScale(scaleType, domain, range, opts = {}) {
  let scale
  let [min, max] = domain
  if (min === undefined || max === undefined) throw new Error('invalid domain')
  const { pivotValue, minScore, maxScore, inverted } = opts
  if (scaleType === 'linear') {
    scale = scaleLinear()
  } else if (scaleType === 'log') {
    scale = scaleLog()
  } else if (scaleType === 'quantize') {
    scale = scaleQuantize()
  } else {
    throw new Error('undefined scaleType')
  }
  if (minScore !== undefined || maxScore !== undefined) {
    ;[min, max] = getNiceDomain(scaleType, [min, max], { minScore, maxScore })
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
 * gets the origin for drawing the graph. for linear this is 0, for log this is arbitrarily set to a low value
 *
 * @param {object} scaleType
 */
export function getOrigin(scaleType /* , pivot, stats */) {
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
 * produces a "nice" domain that actually roungs down to 0 for the min
 * or 0 to the max depending on if all values are positive or negative
 *
 * @param {object} scaleType instance of mst model with a configuration object
 * @param {array} domain array of config paths to read
 * @param {object} opts extra argument blob which can include minScore and maxScore
 */
export function getNiceDomain(scaleType, [min, max], opts = {}) {
  const { minScore, maxScore } = opts
  if (scaleType === 'linear') {
    if (max < 0) max = 0
    if (min > 0) min = 0
  }
  if (scaleType === 'log') {
    if (min > 1) {
      min = 1
    }
  }
  if (minScore !== undefined && minScore !== -Infinity) min = minScore
  if (maxScore !== undefined && maxScore !== Infinity) max = maxScore
  return [min, max]
}
