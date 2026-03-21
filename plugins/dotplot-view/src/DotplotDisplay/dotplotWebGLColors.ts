import { category10 } from '@jbrowse/core/ui/colors'
import {
  cssColorToNormalizedRgb,
  getBlue,
  getGreen,
  getRed,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import type { DotplotFeatPos } from './types.ts'

type RGBA = [number, number, number, number]

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

const category10Normalized = category10.map(hex => cssColorToNormalizedRgb(hex))

function hslColor(hue: number, alpha: number): RGBA {
  const c = parseCssColor(`hsl(${hue}, 100%, 40%)`)
  return [getRed(c) / 255, getGreen(c) / 255, getBlue(c) / 255, alpha]
}

function hslColorFn(
  featureField: string,
  hueScale: number,
  alpha: number,
): (f: DotplotFeatPos) => RGBA {
  const defaultColor: RGBA = [1, 0, 0, alpha]
  return (f: DotplotFeatPos) => {
    const val = f.f.get(featureField) as number | undefined
    if (val !== undefined) {
      return hslColor(val * hueScale, alpha)
    }
    return defaultColor
  }
}

export function createDotplotColorFunction(
  colorBy: string,
  alpha: number,
): (f: DotplotFeatPos, index: number) => RGBA {
  if (colorBy === 'strand') {
    const neg: RGBA = [0, 0, 1, alpha]
    const pos: RGBA = [1, 0, 0, alpha]
    return (f: DotplotFeatPos) => (f.f.get('strand') === -1 ? neg : pos)
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, RGBA>()
    return (f: DotplotFeatPos) => {
      const name = f.f.get('refName') || ''
      let color = colorCache.get(name)
      if (!color) {
        const hash = hashString(name)
        const [r, g, b] =
          category10Normalized[hash % category10Normalized.length]!
        color = [r, g, b, alpha]
        colorCache.set(name, color)
      }
      return color
    }
  }

  if (colorBy === 'identity') {
    return hslColorFn('identity', 120, alpha)
  }

  if (colorBy === 'meanQueryIdentity') {
    return hslColorFn('meanScore', 200, alpha)
  }

  if (colorBy === 'mappingQuality') {
    return hslColorFn('mappingQual', 1, alpha)
  }

  // Default: red
  const defaultColor: RGBA = [1, 0, 0, alpha]
  return () => defaultColor
}
