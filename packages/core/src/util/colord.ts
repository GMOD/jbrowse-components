import { namedColorToHex } from './color/cssColorsLevel4.ts'
import {
  alpha as cbAlpha,
  blend,
  formatHEX,
  formatHEXA,
  getAlpha,
  getBlue,
  getGreen,
  getRed,
  newColor,
  parse,
  toHSLA,
  toRGBA,
} from './color-bits/index.ts'

import type { Color } from './color-bits/index.ts'

interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

interface HSLA {
  h: number
  s: number
  l: number
  a: number
}

export interface Colord {
  alpha(): number
  alpha(value: number): Colord
  toHex(): string
  toRgb(): RGBA
  toRgbString(): string
  toHsl(): HSLA
  toHslString(): string
  mix(color: Colord | string, ratio?: number): Colord
  darken(amount?: number): Colord
  lighten(amount?: number): Colord
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round(value: number, precision = 0) {
  const mult = 10 ** precision
  return Math.round(value * mult) / mult
}

function hslShiftLightness(c: Color, amount: number): Color {
  const hsla = toHSLA(c)
  const newL = clamp(hsla.l + amount, 0, 100)
  const parsed = parse(`hsl(${hsla.h}, ${hsla.s}%, ${newL}%)`)
  return cbAlpha(parsed, getAlpha(c) / 255)
}

function parseInput(
  input: string | { h: number; s: number; l: number },
): Color {
  if (typeof input === 'object') {
    const { h, s, l } = input
    return parse(`hsl(${h}, ${s}%, ${l}%)`)
  }

  const str = input.trim().toLowerCase()

  if (str === 'transparent') {
    return newColor(0, 0, 0, 0)
  }

  const namedHex = namedColorToHex(str)
  if (namedHex) {
    return parse(namedHex)
  }

  try {
    return parse(str)
  } catch {
    return newColor(0, 0, 0, 255)
  }
}

function createColord(c: Color): Colord {
  const obj: Colord = {
    alpha(value?: number): number | Colord {
      if (value === undefined) {
        return getAlpha(c) / 255
      }
      return createColord(cbAlpha(c, value))
    },

    toHex() {
      if (getAlpha(c) < 255) {
        return formatHEXA(c)
      }
      return formatHEX(c)
    },

    toRgb(): RGBA {
      const rgba = toRGBA(c)
      return { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a / 255 }
    },

    toRgbString() {
      const a = getAlpha(c) / 255
      if (a < 1) {
        return `rgba(${getRed(c)}, ${getGreen(c)}, ${getBlue(c)}, ${round(a, 3)})`
      }
      return `rgb(${getRed(c)}, ${getGreen(c)}, ${getBlue(c)})`
    },

    toHsl(): HSLA {
      const hsla = toHSLA(c)
      return {
        h: round(hsla.h, 1),
        s: round(hsla.s, 1),
        l: round(hsla.l, 1),
        a: getAlpha(c) / 255,
      }
    },

    toHslString() {
      const hsla = toHSLA(c)
      const a = getAlpha(c) / 255
      if (a < 1) {
        return `hsla(${round(hsla.h, 1)}, ${round(hsla.s, 1)}%, ${round(hsla.l, 1)}%, ${round(a, 3)})`
      }
      return `hsl(${round(hsla.h, 1)}, ${round(hsla.s, 1)}%, ${round(hsla.l, 1)}%)`
    },

    mix(color2: Colord | string, ratio = 0.5): Colord {
      const c2 =
        typeof color2 === 'string'
          ? parseInput(color2)
          : parseInput(color2.toHex())
      return createColord(blend(c, c2, ratio))
    },

    darken(amount = 0.1): Colord {
      return createColord(hslShiftLightness(c, -amount * 100))
    },

    lighten(amount = 0.1): Colord {
      return createColord(hslShiftLightness(c, amount * 100))
    },
  } as Colord

  return obj
}

export function colord(
  input: string | { h: number; s: number; l: number },
): Colord {
  return createColord(parseInput(input))
}
