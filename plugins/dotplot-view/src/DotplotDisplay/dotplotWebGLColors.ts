import { category10 } from '@jbrowse/core/ui/colors'
import {
  getBlue,
  getGreen,
  getRed,
  packAbgr,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import { hashString } from '../util.ts'

import type { DotplotFeatPos } from './types.ts'

// Pack 0..255 RGB + 0..1 alpha into ABGR u32 matching WGSL's
// unpack4x8unorm / the shader's manual unpack.
function packColor(r: number, g: number, b: number, alpha: number) {
  return packAbgr(r, g, b, Math.round(alpha * 255))
}

// Pre-extract the RGB bytes for the 10-color categorical palette so we can
// bake in the alpha at function-creation time.  The palette has 10 slots; the
// query mode maps chromosome names via hashString(name) % 10, giving a
// deterministic color per chromosome without needing a global pre-scan.
const category10Rgb = category10.map(hex => {
  const c = parseCssColor(hex)
  return [getRed(c), getGreen(c), getBlue(c)] as const
})

function hslColor(hue: number, alpha: number) {
  const c = parseCssColor(`hsl(${hue}, 100%, 40%)`)
  return packColor(getRed(c), getGreen(c), getBlue(c), alpha)
}

function hslColorFn(
  featureField: string,
  hueScale: number,
  alpha: number,
): (f: DotplotFeatPos) => number {
  const defaultColor = packColor(255, 0, 0, alpha)
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
): (f: DotplotFeatPos, index: number) => number {
  if (colorBy === 'strand') {
    const neg = packColor(0, 0, 255, alpha)
    const pos = packColor(255, 0, 0, alpha)
    return (f: DotplotFeatPos) => (f.f.get('strand') === -1 ? neg : pos)
  }

  if (colorBy === 'query') {
    const palette = category10Rgb.map(([r, g, b]) => packColor(r, g, b, alpha))
    const colorCache = new Map<string, number>()
    return (f: DotplotFeatPos) => {
      const name = f.f.get('refName') || ''
      let color = colorCache.get(name)
      if (!color) {
        color = palette[hashString(name) % palette.length]!
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

  const defaultColor = packColor(0, 0, 0, alpha)
  return () => defaultColor
}
