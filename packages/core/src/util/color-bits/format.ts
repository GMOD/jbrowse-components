import { getAlpha, getBlue, getGreen, getRed } from './core.ts'

import type { Color } from './core.ts'

// Return buffer, avoid allocations
const buffer: [number, number, number] = [0, 0, 0]

/**
 * Map 8-bits value to its hexadecimal representation
 * ['00', '01', '02', ..., 'fe', 'ff']
 */
const FORMAT_HEX = Array.from({ length: 256 }).map((_, byte) =>
  byte.toString(16).padStart(2, '0'),
)

/** Format to a #RRGGBBAA string */
export const format = formatHEXA

/** Format to a #RRGGBBAA string */
export function formatHEXA(color: Color) {
  return `#${FORMAT_HEX[getRed(color)]}${FORMAT_HEX[getGreen(color)]}${
    FORMAT_HEX[getBlue(color)]
  }${FORMAT_HEX[getAlpha(color)]}`
}

export function formatHEX(color: Color) {
  return `#${FORMAT_HEX[getRed(color)]}${
    FORMAT_HEX[getGreen(color)]
  }${FORMAT_HEX[getBlue(color)]}`
}

export function formatRGBA(color: Color) {
  return `rgba(${getRed(color)} ${getGreen(color)} ${getBlue(color)} / ${getAlpha(color) / 255})`
}

export function toRGBA(color: Color) {
  return {
    r: getRed(color),
    g: getGreen(color),
    b: getBlue(color),
    a: getAlpha(color),
  }
}

export function formatHSLA(color: Color) {
  rgbToHSL(getRed(color), getGreen(color), getBlue(color))
  const h = buffer[0]
  const s = buffer[1]
  const l = buffer[2]
  const a = getAlpha(color) / 255
  return `hsla(${h} ${s}% ${l}% / ${a})`
}

export function toHSLA(color: Color) {
  rgbToHSL(getRed(color), getGreen(color), getBlue(color))
  const h = buffer[0]
  const s = buffer[1]
  const l = buffer[2]
  const a = getAlpha(color) / 255
  return { h, s, l, a }
}

/**
 * Returns [r, g, b] as floats in 0-1 range, suitable for GPU shader uniforms.
 */
export function toGLrgb(color: Color): [number, number, number] {
  return [getRed(color) / 255, getGreen(color) / 255, getBlue(color) / 255]
}

// Conversion functions
// https://www.30secondsofcode.org/js/s/rgb-hex-hsl-hsb-color-format-conversion/
function rgbToHSL(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  // `l` here is the max channel (HSV value) and `s` the chroma, not the HSL
  // lightness/saturation; the real lightness is (max + min) / 2 = l - s / 2
  const l = Math.max(r, g, b)
  const s = l - Math.min(r, g, b)
  const h = s
    ? l === r
      ? (g - b) / s
      : l === g
        ? 2 + (b - r) / s
        : 4 + (r - g) / s
    : 0
  // the saturation formula is picked by lightness, not by the max channel:
  // branching on `l` understated it whenever max > 0.5 while lightness < 0.5
  // (e.g. #0a0ac8 came out 63.3% instead of 90.5%)
  const doubleLightness = 2 * l - s
  buffer[0] = 60 * h < 0 ? 60 * h + 360 : 60 * h
  buffer[1] =
    100 *
    (s
      ? doubleLightness <= 1
        ? s / doubleLightness
        : s / (2 - doubleLightness)
      : 0)
  buffer[2] = (100 * doubleLightness) / 2
}

// https://stackoverflow.com/a/29463581/3112706
