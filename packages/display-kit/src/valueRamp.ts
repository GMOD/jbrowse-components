import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import { quantileExtent } from '@jbrowse/core/util/quantileExtent'
import { rampGapScales } from '@jbrowse/core/util/thresholdScale'

import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type {
  ColorEncoding,
  ContinuousRef,
} from '@jbrowse/core/util/markEncoding'

type ContinuousColorScale = ReturnType<typeof continuousColorScale>

const NO_EXTENT: [number, number] = [Infinity, -Infinity]

// Enough to read the ramp's shape without the bar becoming a table of stops.
const RAMP_KEY_STOPS = 8

/** The encoding while it paints along a linear, log or symlog ramp. */
export function rampEncodingOf(
  encoding: ColorEncoding | undefined,
): ContinuousRef | undefined {
  return typeof encoding === 'object' &&
    (encoding.scale === 'linear' ||
      encoding.scale === 'log' ||
      encoding.scale === 'symlog')
    ? encoding
    : undefined
}

/** The number a value's text reads as: blank is none, where `Number` reads 0. */
export function numericText(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

/** The CSS color a value's text paints along `ramp`, no value the no-value grey. */
export function rampTextColor(ramp: ContinuousColorScale, text: string) {
  return text === ''
    ? NO_CATEGORY_COLOR
    : abgrToCssRgba(ramp.colorOf(numericText(text)))
}

/**
 * The key a ramp draws under `id`: the bar over its domain, its ends marked
 * where `extremes`, the loaded values', run past them, and a row apiece for
 * the values it has no color for.
 */
export function rampKeyScales(
  id: string,
  title: string | undefined,
  ramp: ContinuousColorScale,
  extremes: readonly [number, number],
  gaps: { missing: boolean; notNumber: boolean },
): ColorScale[] {
  return [
    {
      kind: 'ramp',
      id,
      title,
      domain: ramp.domain,
      stops: stopsFromRampLut(ramp.lut, RAMP_KEY_STOPS, ramp.midNorm),
      extent: extremes,
    },
    ...rampGapScales(`${id}-gaps`, gaps),
  ]
}

/** A ramp over the values a display loaded, each weighed once. */
export interface ValueRamp {
  colorOf: (text: string) => string
  keyScales: (id: string, title: string | undefined) => ColorScale[]
}

/**
 * The ramp `encoding` paints over `values`, a display's loaded field values
 * as text: an open end of its domain follows them, clipped at
 * `domainQuantile`.
 */
export function valueRampOf(
  encoding: ContinuousRef,
  values: Iterable<string>,
): ValueRamp {
  const numbers: number[] = []
  let min = Infinity
  let max = -Infinity
  let missing = false
  let notNumber = false
  for (const text of values) {
    const value = numericText(text)
    if (Number.isFinite(value)) {
      numbers.push(value)
      min = Math.min(min, value)
      max = Math.max(max, value)
    } else if (text === '') {
      missing = true
    } else if (Number.isNaN(value)) {
      notNumber = true
    }
  }
  const quantile = encoding.domainQuantile ?? 1
  const extent: [number, number] =
    quantile < 1
      ? quantileExtent(numbers, numbers.length, quantile)
      : [min, max]
  const ramp = continuousColorScale(
    encoding,
    encoding.domainMin !== undefined && encoding.domainMax !== undefined
      ? NO_EXTENT
      : extent,
  )
  return {
    colorOf: text => rampTextColor(ramp, text),
    keyScales: (id, title) =>
      rampKeyScales(id, title, ramp, [min, max], { missing, notNumber }),
  }
}
