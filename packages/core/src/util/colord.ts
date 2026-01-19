import { namedColorToHex } from './color/cssColorsLevel4.ts'

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
  toRgbString(): string
  toHsl(): HSLA
  toHslString(): string
  mix(color: Colord | string, ratio?: number): Colord
  darken(amount?: number): Colord
  lighten(amount?: number): Colord
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number, precision = 0): number {
  const mult = 10 ** precision
  return Math.round(value * mult) / mult
}

function parseHex(hex: string): RGBA | null {
  const match = /^#([0-9a-f]{3,8})$/i.exec(hex)
  if (!match) {
    return null
  }
  const hexStr = match[1]!
  if (hexStr.length === 3) {
    return {
      r: parseInt(hexStr[0]! + hexStr[0], 16),
      g: parseInt(hexStr[1]! + hexStr[1], 16),
      b: parseInt(hexStr[2]! + hexStr[2], 16),
      a: 1,
    }
  }
  if (hexStr.length === 4) {
    return {
      r: parseInt(hexStr[0]! + hexStr[0], 16),
      g: parseInt(hexStr[1]! + hexStr[1], 16),
      b: parseInt(hexStr[2]! + hexStr[2], 16),
      a: parseInt(hexStr[3]! + hexStr[3], 16) / 255,
    }
  }
  if (hexStr.length === 6) {
    return {
      r: parseInt(hexStr.slice(0, 2), 16),
      g: parseInt(hexStr.slice(2, 4), 16),
      b: parseInt(hexStr.slice(4, 6), 16),
      a: 1,
    }
  }
  if (hexStr.length === 8) {
    return {
      r: parseInt(hexStr.slice(0, 2), 16),
      g: parseInt(hexStr.slice(2, 4), 16),
      b: parseInt(hexStr.slice(4, 6), 16),
      a: parseInt(hexStr.slice(6, 8), 16) / 255,
    }
  }
  return null
}

function parseRgb(str: string): RGBA | null {
  const match =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
      str,
    )
  if (match) {
    return {
      r: parseInt(match[1]!, 10),
      g: parseInt(match[2]!, 10),
      b: parseInt(match[3]!, 10),
      a: match[4] ? parseFloat(match[4]) : 1,
    }
  }
  return null
}

function parseHsl(str: string): RGBA | null {
  const match =
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
      str,
    )
  if (match) {
    const h = parseFloat(match[1]!)
    const s = parseFloat(match[2]!) / 100
    const l = parseFloat(match[3]!) / 100
    const a = match[4] ? parseFloat(match[4]) : 1
    return { ...hslToRgb(h, s, l), a }
  }
  return null
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6
  } else {
    h = ((r - g) / d + 4) / 6
  }

  return { h: h * 360, s, l }
}

function parseColor(input: string | { h: number; s: number; l: number }): RGBA {
  if (typeof input === 'object') {
    const { h, s, l } = input
    return { ...hslToRgb(h, s / 100, l / 100), a: 1 }
  }

  const str = input.trim().toLowerCase()

  const namedHex = namedColorToHex(str)
  if (namedHex) {
    return parseHex(namedHex)!
  }

  if (str === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 }
  }

  const hex = parseHex(str)
  if (hex) {
    return hex
  }

  const rgb = parseRgb(str)
  if (rgb) {
    return rgb
  }

  const hsl = parseHsl(str)
  if (hsl) {
    return hsl
  }

  return { r: 0, g: 0, b: 0, a: 1 }
}

function toHex2(n: number): string {
  return Math.round(clamp(n, 0, 255))
    .toString(16)
    .padStart(2, '0')
}

function createColord(rgba: RGBA): Colord {
  const obj: Colord = {
    alpha(value?: number): number | Colord {
      if (value === undefined) {
        return rgba.a
      }
      return createColord({ ...rgba, a: clamp(value, 0, 1) })
    },

    toHex(): string {
      const { r, g, b, a } = rgba
      if (a < 1) {
        return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${toHex2(a * 255)}`
      }
      return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
    },

    toRgbString(): string {
      const { r, g, b, a } = rgba
      if (a < 1) {
        return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${round(a, 3)})`
      }
      return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
    },

    toHsl(): HSLA {
      const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b)
      return {
        h: round(h, 1),
        s: round(s * 100, 1),
        l: round(l * 100, 1),
        a: rgba.a,
      }
    },

    toHslString(): string {
      const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b)
      if (rgba.a < 1) {
        return `hsla(${round(h, 1)}, ${round(s * 100, 1)}%, ${round(l * 100, 1)}%, ${round(rgba.a, 3)})`
      }
      return `hsl(${round(h, 1)}, ${round(s * 100, 1)}%, ${round(l * 100, 1)}%)`
    },

    mix(color2: Colord | string, ratio = 0.5): Colord {
      const c2 =
        typeof color2 === 'string'
          ? parseColor(color2)
          : parseColor(color2.toHex())
      const r = rgba.r + (c2.r - rgba.r) * ratio
      const g = rgba.g + (c2.g - rgba.g) * ratio
      const b = rgba.b + (c2.b - rgba.b) * ratio
      const a = rgba.a + (c2.a - rgba.a) * ratio
      return createColord({ r, g, b, a })
    },

    darken(amount = 0.1): Colord {
      const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b)
      const newL = clamp(l - amount, 0, 1)
      const rgb = hslToRgb(h, s, newL)
      return createColord({ ...rgb, a: rgba.a })
    },

    lighten(amount = 0.1): Colord {
      const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b)
      const newL = clamp(l + amount, 0, 1)
      const rgb = hslToRgb(h, s, newL)
      return createColord({ ...rgb, a: rgba.a })
    },
  } as Colord

  return obj
}

export function colord(
  input: string | { h: number; s: number; l: number },
): Colord {
  return createColord(parseColor(input))
}
