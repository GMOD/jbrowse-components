import { category10 } from '@jbrowse/core/ui/colors'
import {
  getBlue,
  getGreen,
  getRed,
  packAbgr,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'
import { hashString } from '@jbrowse/synteny-core'

import type { DotplotRpcData } from './types.ts'

export type DotplotColorFn = (data: DotplotRpcData, index: number) => number

function packColor(r: number, g: number, b: number, alpha: number) {
  return packAbgr(r, g, b, Math.round(alpha * 255))
}

// Pure HSL → packed-RGBA conversion. Previously this round-tripped through a
// `hsl(...)` CSS string + parseCssColor; doing the math directly avoids
// allocating a string per feature for identity/score-colored dotplots.
// Reference: https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB_alternative
function hslColor(hue: number, alpha: number) {
  const s = 1
  const l = 0.4
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return packColor(
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
    alpha,
  )
}

const category10Rgb = category10.map(hex => {
  const c = parseCssColor(hex)
  return [getRed(c), getGreen(c), getBlue(c)] as const
})

export function unpackColorToCSS(packed: number) {
  const r = packed & 0xff
  const g = (packed >>> 8) & 0xff
  const b = (packed >>> 16) & 0xff
  const a = (packed >>> 24) / 255
  return `rgba(${r},${g},${b},${a})`
}

function scaledHueColorFn(
  values: Float32Array,
  hueScale: number,
  alpha: number,
): DotplotColorFn {
  // Negative values are the "missing data" sentinel (-1 in the worker); paint
  // red so they stand out against the otherwise green/yellow identity gradient.
  const missing = packColor(255, 0, 0, alpha)
  return (_data, i) => {
    const v = values[i]!
    return v >= 0 ? hslColor(v * hueScale, alpha) : missing
  }
}

function strandColorFn(alpha: number): DotplotColorFn {
  const neg = packColor(0, 0, 255, alpha)
  const pos = packColor(255, 0, 0, alpha)
  return (d, i) => (d.strands[i] === -1 ? neg : pos)
}

function queryColorFn(alpha: number): DotplotColorFn {
  const palette = category10Rgb.map(([r, g, b]) => packColor(r, g, b, alpha))
  const cache = new Map<string, number>()
  return (d, i) => {
    const name = d.refNames[i]!
    let color = cache.get(name)
    if (color === undefined) {
      color = palette[hashString(name) % palette.length]!
      cache.set(name, color)
    }
    return color
  }
}

function constantColorFn(packed: number): DotplotColorFn {
  return () => packed
}

export function createDotplotColorFunction(
  colorBy: string,
  alpha: number,
  data: DotplotRpcData,
): DotplotColorFn {
  switch (colorBy) {
    case 'strand':
      return strandColorFn(alpha)
    case 'query':
      return queryColorFn(alpha)
    // Hue scales chosen so the visible range maps to a meaningful gradient:
    // identity (0..1) → red→green; meanScore (0..1) → red→blue; MAPQ (0..60)
    // → red→yellow (MAPQ is already a small-int hue).
    case 'identity':
      return scaledHueColorFn(data.identities, 120, alpha)
    case 'meanQueryIdentity':
      return scaledHueColorFn(data.meanScores, 200, alpha)
    case 'mappingQuality':
      return scaledHueColorFn(data.mappingQuals, 1, alpha)
    default:
      return constantColorFn(packColor(0, 0, 0, alpha))
  }
}
