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

export function cssColorToRgb(color: string): [number, number, number] {
  const c = parseCssColor(color)
  return [getRed(c), getGreen(c), getBlue(c)]
}

export function cssColorToRgba(
  color: string,
): [number, number, number, number] {
  const c = parseCssColor(color)
  return [getRed(c), getGreen(c), getBlue(c), getAlpha(c)]
}

// Pack 0..255 RGBA channel bytes into an ABGR u32 (R at byte 0, A at byte 3).
// >>> 0 keeps the result an unsigned 32-bit — bit 31 (alpha's top bit) would
// otherwise make opaque colors negative in JS.
export function packAbgr(r: number, g: number, b: number, a: number) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function cssColorToABGR(color: string) {
  const c = parseCssColor(color)
  return packAbgr(getRed(c), getGreen(c), getBlue(c), getAlpha(c))
}

// Pack a 0..1 normalized RGB triple into an ABGR u32 (opaque alpha). Inverse
// of cssColorToNormalizedRgb at the GPU write boundary — the shader side
// unpacks with unpackRGBA() (see packages/core/src/gpu/shaders/colorPack.slang).
export function normalizedRgbToABGR(r: number, g: number, b: number) {
  return packAbgr(
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
    255,
  )
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

// Set fillStyle from an ABGR-packed u32.
export function setAbgrFill(
  ctx: { fillStyle: string | CanvasGradient | CanvasPattern },
  c: number,
) {
  ctx.fillStyle = abgrToCssRgba(c)
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
