import { scaleLinear, scaleLog, scaleQuantize } from 'd3-scale'

export function getScale(scaleType, [min, max], range, opts = {}) {
  let scale
  const { pivotValue } = opts
  if (scaleType === 'linear') {
    scale = scaleLinear()
  } else if (scaleType === 'log') {
    scale = scaleLog()
  } else if (scaleType === 'quantize') {
    scale = scaleQuantize()
  } else {
    throw new Error('undefined scaleType')
  }
  return scale
    .domain(pivotValue !== undefined ? [min, pivotValue, max] : [min, max])
    .range(opts.inverted ? range.reverse() : range)
}

export function getOrigin(scaleType, pivot, stats) {
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
    return 0.5
  }
  return 0
}

export function bumpDomain([min, max], scaleType) {
  let retMin = min
  let retMax = max
  if (max < 0) retMax = 0
  if (min > 0) retMin = 0
  if (scaleType === 'log') {
    if (min > 1) {
      retMin = 0.5
    }
  }
  return [retMin, retMax]
}

export function hello() {
  console.log('hello world')
}
