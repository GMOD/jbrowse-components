import { category10 } from '@jbrowse/core/ui/colors'
import {
  getBlue,
  getGreen,
  getRed,
  packAbgr,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import { hashString } from '../util.ts'

import type { DotplotRpcData } from './types.ts'

function packColor(r: number, g: number, b: number, alpha: number) {
  return packAbgr(r, g, b, Math.round(alpha * 255))
}

const category10Rgb = category10.map(hex => {
  const c = parseCssColor(hex)
  return [getRed(c), getGreen(c), getBlue(c)] as const
})

function hslColor(hue: number, alpha: number) {
  const c = parseCssColor(`hsl(${hue}, 100%, 40%)`)
  return packColor(getRed(c), getGreen(c), getBlue(c), alpha)
}

export type DotplotColorFn = (data: DotplotRpcData, index: number) => number

export function unpackColorToCSS(packed: number) {
  const r = packed & 0xff
  const g = (packed >>> 8) & 0xff
  const b = (packed >>> 16) & 0xff
  const a = (packed >>> 24) / 255
  return `rgba(${r},${g},${b},${a})`
}

function hslColorFn(values: Float32Array, hueScale: number, alpha: number) {
  const defaultColor = packColor(255, 0, 0, alpha)
  return (_data: DotplotRpcData, index: number) => {
    const val = values[index]!
    if (val >= 0) {
      return hslColor(val * hueScale, alpha)
    }
    return defaultColor
  }
}

export function createDotplotColorFunction(
  colorBy: string,
  alpha: number,
  data: DotplotRpcData,
): DotplotColorFn {
  if (colorBy === 'strand') {
    const neg = packColor(0, 0, 255, alpha)
    const pos = packColor(255, 0, 0, alpha)
    return (d, i) => (d.strands[i] === -1 ? neg : pos)
  }

  if (colorBy === 'query') {
    const palette = category10Rgb.map(([r, g, b]) => packColor(r, g, b, alpha))
    const colorCache = new Map<string, number>()
    return (d, i) => {
      const name = d.refNames[i]!
      let color = colorCache.get(name)
      if (color === undefined) {
        color = palette[hashString(name) % palette.length]!
        colorCache.set(name, color)
      }
      return color
    }
  }

  if (colorBy === 'identity') {
    return hslColorFn(data.identities, 120, alpha)
  }

  if (colorBy === 'meanQueryIdentity') {
    return hslColorFn(data.meanScores, 200, alpha)
  }

  if (colorBy === 'mappingQuality') {
    return hslColorFn(data.mappingQuals, 1, alpha)
  }

  const defaultColor = packColor(0, 0, 0, alpha)
  return () => defaultColor
}
