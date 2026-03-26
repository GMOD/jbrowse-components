import * as convert from './convert.ts'
import { newColor } from './core.ts'

import type { Color } from './core.ts'

const HASH = '#'.charCodeAt(0)
const PERCENT = '%'.charCodeAt(0)
const G = 'g'.charCodeAt(0)
const N = 'n'.charCodeAt(0)
const D = 'd'.charCodeAt(0)
const E = 'e'.charCodeAt(0)

/**
 * Approximative CSS colorspace string pattern, e.g. rgb(), color()
 */
const PATTERN = (() => {
  const NAME = String.raw`(\w+)`
  const SEPARATOR = String.raw`[\s,\/]`
  const VALUE = String.raw`([^\s,\/]+)`
  const SEPARATOR_THEN_VALUE = `(?:${SEPARATOR}+${VALUE})`
  return new RegExp(
    String.raw`${NAME}\(
      ${SEPARATOR}*
      ${VALUE}
      ${SEPARATOR_THEN_VALUE}
      ${SEPARATOR_THEN_VALUE}
      ${SEPARATOR_THEN_VALUE}?
      ${SEPARATOR_THEN_VALUE}?
      ${SEPARATOR}*
    \)`.replace(/\s/g, ''),
  )
})()

/**
 * Parse CSS color
 * @param color CSS color string: #xxx, #xxxxxx, #xxxxxxxx, rgb(), rgba(), hsl(), hsla(), color()
 */
export function parse(color: string): Color {
  return color.charCodeAt(0) === HASH ? parseHex(color) : parseColor(color)
}

/**
 * Parse hexadecimal CSS color
 * @param color Hex color string: #xxx, #xxxxxx, #xxxxxxxx
 */
export function parseHex(color: string): Color {
  let r = 0x00
  let g = 0x00
  let b = 0x00
  let a = 0xff
  switch (color.length) {
    // #59f
    case 4: {
      r = (hexValue(color.charCodeAt(1)) << 4) + hexValue(color.charCodeAt(1))
      g = (hexValue(color.charCodeAt(2)) << 4) + hexValue(color.charCodeAt(2))
      b = (hexValue(color.charCodeAt(3)) << 4) + hexValue(color.charCodeAt(3))
      break
    }
    // #5599ff
    case 7: {
      r = (hexValue(color.charCodeAt(1)) << 4) + hexValue(color.charCodeAt(2))
      g = (hexValue(color.charCodeAt(3)) << 4) + hexValue(color.charCodeAt(4))
      b = (hexValue(color.charCodeAt(5)) << 4) + hexValue(color.charCodeAt(6))
      break
    }
    // #5599ff88
    case 9: {
      r = (hexValue(color.charCodeAt(1)) << 4) + hexValue(color.charCodeAt(2))
      g = (hexValue(color.charCodeAt(3)) << 4) + hexValue(color.charCodeAt(4))
      b = (hexValue(color.charCodeAt(5)) << 4) + hexValue(color.charCodeAt(6))
      a = (hexValue(color.charCodeAt(7)) << 4) + hexValue(color.charCodeAt(8))
      break
    }
    default: {
      break
    }
  }
  return newColor(r, g, b, a)
}

// https://lemire.me/blog/2019/04/17/parsing-short-hexadecimal-strings-efficiently/
function hexValue(c: number) {
  return (c & 0xf) + 9 * (c >> 6)
}

/**
 * Parse CSS color
 * https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
 * @param color CSS color string: rgb(), rgba(), hsl(), hsla(), color()
 */
export function parseColor(color: string): Color {
  const match = PATTERN.exec(color)
  if (match === null) {
    throw new Error(`Color.parse(): invalid CSS color: "${color}"`)
  }
  const fmt = match[1]!
  const p1 = match[2]!
  const p2 = match[3]!
  const p3 = match[4]!
  const p4 = match[5]
  const p5 = match[6]
  switch (fmt) {
    case 'rgb':
    case 'rgba': {
      const r = parseColorChannel(p1)
      const g = parseColorChannel(p2)
      const b = parseColorChannel(p3)
      const a = p4 ? parseAlphaChannel(p4) : 255
      return newColor(r, g, b, a)
    }
    case 'hsl':
    case 'hsla': {
      const h = parseAngle(p1)
      const s = parsePercentage(p2)
      const l = parsePercentage(p3)
      const a = p4 ? parseAlphaChannel(p4) : 255
      // https://stackoverflow.com/a/9493060/3112706
      let r: number
      let g: number
      let b: number
      if (s === 0) {
        r = g = b = Math.round(l * 255) // achromatic
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = Math.round(hueToRGB(p, q, h + 1 / 3) * 255)
        g = Math.round(hueToRGB(p, q, h) * 255)
        b = Math.round(hueToRGB(p, q, h - 1 / 3) * 255)
      }
      return newColor(r, g, b, a)
    }
    case 'hwb': {
      const h = parseAngle(p1)
      const w = parsePercentage(p2)
      const bl = parsePercentage(p3)
      const a = p4 ? parseAlphaChannel(p4) : 255
      /* https://drafts.csswg.org/css-color/#hwb-to-rgb */
      const s = 1
      const l = 0.5
      // Same as HSL to RGB
      const q = l + s - l * s
      const p = 2 * l - q
      let r = Math.round(hueToRGB(p, q, h + 1 / 3) * 255)
      let g = Math.round(hueToRGB(p, q, h) * 255)
      let b = Math.round(hueToRGB(p, q, h - 1 / 3) * 255)
      // Then HWB
      r = hwbApply(r, w, bl)
      g = hwbApply(g, w, bl)
      b = hwbApply(b, w, bl)
      return newColor(r, g, b, a)
    }
    case 'lab': {
      const l = parsePercentageFor(p1, 100)
      const aa = parsePercentageFor(p2, 125)
      const b = parsePercentageFor(p3, 125)
      const a = p4 ? parseAlphaChannel(p4) : 255
      return newColorFromArray(
        a,
        convert.xyzd50ToSrgb(...convert.labToXyzd50(l, aa, b)),
      )
    }
    case 'lch': {
      const l = parsePercentageFor(p1, 100)
      const c = parsePercentageFor(p2, 150)
      const h = parseAngle(p3) * 360
      const a = p4 ? parseAlphaChannel(p4) : 255
      return newColorFromArray(
        a,
        convert.xyzd50ToSrgb(
          ...convert.labToXyzd50(...convert.lchToLab(l, c, h)),
        ),
      )
    }
    case 'oklab': {
      const l = parsePercentageFor(p1, 1)
      const aa = parsePercentageFor(p2, 0.4)
      const b = parsePercentageFor(p3, 0.4)
      const a = p4 ? parseAlphaChannel(p4) : 255
      return newColorFromArray(
        a,
        convert.xyzd50ToSrgb(
          ...convert.xyzd65ToD50(...convert.oklabToXyzd65(l, aa, b)),
        ),
      )
    }
    case 'oklch': {
      const l = parsePercentageOrValue(p1)
      const c = parsePercentageOrValue(p2)
      const h = parsePercentageOrValue(p3)
      const a = p4 ? parseAlphaChannel(p4) : 255
      return newColorFromArray(
        a,
        convert.xyzd50ToSrgb(...convert.oklchToXyzd50(l, c, h)),
      )
    }
    case 'color': {
      // https://drafts.csswg.org/css-color-4/#color-function
      const colorspace = p1
      const c1 = parsePercentageOrValue(p2)
      const c2 = parsePercentageOrValue(p3)
      const c3 = parsePercentageOrValue(p4!)
      const a = p5 ? parseAlphaChannel(p5) : 255
      switch (colorspace) {
        // RGB color spaces
        case 'srgb': {
          return newColorFromArray(a, [c1, c2, c3])
        }
        case 'srgb-linear': {
          return newColorFromArray(
            a,
            convert.xyzd50ToSrgb(...convert.srgbLinearToXyzd50(c1, c2, c3)),
          )
        }
        case 'display-p3': {
          return newColorFromArray(
            a,
            convert.xyzd50ToSrgb(...convert.displayP3ToXyzd50(c1, c2, c3)),
          )
        }
        case 'a98-rgb': {
          return newColorFromArray(
            a,
            convert.xyzd50ToSrgb(...convert.adobeRGBToXyzd50(c1, c2, c3)),
          )
        }
        case 'prophoto-rgb': {
          return newColorFromArray(
            a,
            convert.xyzd50ToSrgb(...convert.proPhotoToXyzd50(c1, c2, c3)),
          )
        }
        case 'rec2020': {
          return newColorFromArray(
            a,
            convert.xyzd50ToSrgb(...convert.rec2020ToXyzd50(c1, c2, c3)),
          )
        }
        // XYZ color spaces
        case 'xyz':
        case 'xyz-d65': {
          return newColorFromArray(
            a,
            convert.xyzd50ToSrgb(...convert.xyzd65ToD50(c1, c2, c3)),
          )
        }
        case 'xyz-d50': {
          return newColorFromArray(a, convert.xyzd50ToSrgb(c1, c2, c3))
        }
        default:
      }
      break
    }
    default:
  }
  throw new Error(`Color.parse(): invalid CSS color: "${color}"`)
}

/**
 * Accepts: "50%", "128"
 * https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgb#values
 * @returns a value in the 0 to 255 range
 */
function parseColorChannel(channel: string) {
  if (channel.charCodeAt(channel.length - 1) === PERCENT) {
    return Math.round((parseFloat(channel) / 100) * 255)
  }
  return Math.round(parseFloat(channel))
}

/**
 * Accepts: "50%", ".5", "0.5"
 * https://developer.mozilla.org/en-US/docs/Web/CSS/alpha-value
 * @returns a value in the [0, 255] range
 */
function parseAlphaChannel(channel: string) {
  return Math.round(parseAlphaValue(channel) * 255)
}

/**
 * Accepts: "50%", ".5", "0.5"
 * https://developer.mozilla.org/en-US/docs/Web/CSS/alpha-value
 * @returns a value in the [0, 1] range
 */
function parseAlphaValue(channel: string) {
  if (channel.charCodeAt(0) === N) {
    return 0
  }
  if (channel.charCodeAt(channel.length - 1) === PERCENT) {
    return parseFloat(channel) / 100
  }
  return parseFloat(channel)
}

/**
 * Accepts: "360", "360deg", "400grad", "6.28rad", "1turn", "none"
 * https://developer.mozilla.org/en-US/docs/Web/CSS/angle
 * @returns a value in the 0.0 to 1.0 range
 */
function parseAngle(angle: string) {
  let factor: number
  switch (angle.charCodeAt(angle.length - 1)) {
    case E: {
      // 'none'
      return 0
    }
    case D: {
      // 'rad', 'grad'
      factor =
        angle.charCodeAt(Math.max(0, angle.length - 4)) === G
          ? 400
          : 2 * Math.PI // TAU
      break
    }
    case N: {
      // 'turn'
      factor = 1
      break
    }
    // case G: // 'deg', but no need to check as it's also the default
    default: {
      factor = 360
    }
  }
  return parseFloat(angle) / factor
}

/**
 * Accepts: "100%", "none"
 * @returns a value in the 0.0 to 1.0 range
 */
function parsePercentage(value: string) {
  if (value.charCodeAt(0) === N) {
    return 0
  }
  return parseFloat(value) / 100
}

/**
 * Accepts: "1.0", "100%", "none"
 * @returns a value in the 0.0 to 1.0 range
 */
function parsePercentageOrValue(value: string) {
  if (value.charCodeAt(0) === N) {
    return 0
  }
  if (value.charCodeAt(value.length - 1) === PERCENT) {
    return parseFloat(value) / 100
  }
  return parseFloat(value)
}

/**
 * Accepts: "100", "100%", "none"
 * @returns a value in the -@range to @range range
 */
function parsePercentageFor(value: string, range: number) {
  if (value.charCodeAt(0) === N) {
    return 0
  }
  if (value.charCodeAt(value.length - 1) === PERCENT) {
    return (parseFloat(value) / 100) * range
  }
  return parseFloat(value)
}

// HSL functions
function hueToRGB(p: number, q: number, t: number) {
  if (t < 0) {
    t += 1
  }
  if (t > 1) {
    t -= 1
  }
  if (t < 1 / 6) {
    return p + (q - p) * 6 * t
  }
  if (t < 1 / 2) {
    return q
  }
  if (t < 2 / 3) {
    return p + (q - p) * (2 / 3 - t) * 6
  }
  return p
}

// HWB functions
function hwbApply(channel: number, w: number, b: number) {
  let result = channel / 255
  result *= 1 - w - b
  result += w
  return Math.round(result * 255)
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, value))
}

function newColorFromArray(a: number, rgb: [number, number, number]) {
  const r = clamp(Math.round(rgb[0] * 255))
  const g = clamp(Math.round(rgb[1] * 255))
  const b = clamp(Math.round(rgb[2] * 255))
  return newColor(r, g, b, a)
}
