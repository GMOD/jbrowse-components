import {
  scaleLinear,
  scaleLog,
  scaleQuantize,
} from '@mui/x-charts-vendor/d3-scale'

export interface ScaleOpts {
  domain: number[]
  range: number[]
  scaleType: string
  pivotValue?: number
  inverted?: boolean
}

function createScaleForType(scaleType: string) {
  if (scaleType === 'linear') {
    return scaleLinear()
  }
  if (scaleType === 'log') {
    return scaleLog().base(2)
  }
  if (scaleType === 'quantize') {
    return scaleQuantize()
  }
  throw new Error(`undefined scaleType: ${scaleType}`)
}

export function getScale({
  domain,
  range,
  scaleType,
  pivotValue,
  inverted,
}: ScaleOpts) {
  const [min, max] = domain
  if (min === undefined || max === undefined) {
    throw new Error('invalid domain')
  }
  const [rangeMin, rangeMax] = range
  if (rangeMin === undefined || rangeMax === undefined) {
    throw new Error('invalid range')
  }
  const scale = createScaleForType(scaleType)
  scale.domain(pivotValue !== undefined ? [min, pivotValue, max] : [min, max])
  scale.nice()
  scale.range(inverted ? range.slice().reverse() : range)
  return scale
}

export function getOrigin(scaleType: string) {
  if (scaleType === 'log') {
    return 1
  }
  return 0
}

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
    if (min >= 0 && max > 1) {
      min = 1
    }
  }

  if (minScore !== undefined) {
    min = minScore
  }
  if (maxScore !== undefined) {
    max = maxScore
  }
  const scale = createScaleForType(scaleType)
  scale.domain([min, max])
  scale.nice()
  return scale.domain() as [number, number]
}
