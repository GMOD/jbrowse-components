import { namedColorToHex } from './color/cssColorsLevel4.ts'
import {
  getAlpha,
  getBlue,
  getGreen,
  getRed,
  newColor,
  parse,
} from './color-bits/index.ts'

export {
  alpha,
  blend,
  darken,
  formatHEX,
  formatHEXA,
  formatRGBA,
  getAlpha,
  getBlue,
  getGreen,
  getLuminance,
  getRed,
  lighten,
  newColor,
  parse,
  toHSLA,
  toRGBA,
} from './color-bits/index.ts'
export type { Color } from './color-bits/index.ts'

export function parseCssColor(color: string) {
  const str = color.trim().toLowerCase()
  if (str === 'transparent') {
    return newColor(0, 0, 0, 0)
  }
  const hex = namedColorToHex(str)
  if (hex) {
    return parse(hex)
  }
  return parse(str)
}

export function cssColorToNormalizedRgb(
  color: string,
): [number, number, number] {
  const c = parseCssColor(color)
  return [getRed(c) / 255, getGreen(c) / 255, getBlue(c) / 255]
}

export function cssColorToRgba(
  color: string,
): [number, number, number, number] {
  const c = parseCssColor(color)
  return [getRed(c), getGreen(c), getBlue(c), getAlpha(c)]
}

export function cssColorToABGR(color: string) {
  const c = parseCssColor(color)
  const r = getRed(c)
  const g = getGreen(c)
  const b = getBlue(c)
  const a = getAlpha(c)
  // >>> 0 converts signed int32 to unsigned uint32; without it, opaque colors
  // (alpha=255) set bit 31 and produce a negative JS number
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}

// Pack a 0..1 normalized RGB triple into an ABGR u32 (opaque alpha). Inverse
// of cssColorToNormalizedRgb at the GPU write boundary — the shader side
// unpacks with unpackRGBA() (see packages/core/src/gpu/shaders/colorPack.slang).
export function normalizedRgbToABGR(r: number, g: number, b: number) {
  const rb = Math.round(r * 255) & 0xff
  const gb = Math.round(g * 255) & 0xff
  const bb = Math.round(b * 255) & 0xff
  return (rb | (gb << 8) | (bb << 16) | 0xff000000) >>> 0
}

// Format a 0..1 normalized RGB triple as a CSS `rgb(r,g,b)` string.
export function normalizedRgbToCss(c: readonly [number, number, number]) {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
}

// Format a 0..1 normalized RGB triple + alpha as a CSS `rgba(r,g,b,a)` string.
// Preferred over `ctx.globalAlpha = a; fillStyle = rgb(...)` bracketing.
export function normalizedRgbToCssRgba(
  c: readonly [number, number, number],
  alpha: number,
) {
  return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${alpha})`
}

// Channel accessors for the ABGR packed layout (R at byte 0, A at byte 3 —
// the layout produced by cssColorToABGR and consumed by GPU shaders that
// unpack via bit shifts from a u32 vertex attribute). Mirror of the
// color-bits getRed/Green/Blue/Alpha, which operate on the canonical
// 0xRRGGBBAA layout and therefore give wrong results if called on an ABGR
// value.
export function abgrRed(c: number) {
  return c & 0xff
}
export function abgrGreen(c: number) {
  return (c >>> 8) & 0xff
}
export function abgrBlue(c: number) {
  return (c >>> 16) & 0xff
}
export function abgrAlpha(c: number) {
  return (c >>> 24) & 0xff
}

// Format an ABGR-packed u32 as a CSS rgba() string.
export function abgrToCssRgba(c: number) {
  return `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${abgrAlpha(c) / 255})`
}

export function cssColorToNormalizedRgba(
  color: string,
): [number, number, number, number] {
  const c = parseCssColor(color)
  return [
    getRed(c) / 255,
    getGreen(c) / 255,
    getBlue(c) / 255,
    getAlpha(c) / 255,
  ]
}
