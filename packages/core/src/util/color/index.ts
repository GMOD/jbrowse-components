import {
  darken,
  getContrastRatio,
  lighten,
  emphasize as muiEmphasize,
  getLuminance as muiGetLuminance,
} from '@mui/material/styles'

import { namedColorToHex } from './cssColorsLevel4.ts'

/**
 * Algorithmically pick a contrasting text color that will
 * be visible on top of the given background color. Either
 * black or white.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(),
 *  hsl(), hsla(), or named color
 * @returns 'black' or 'white'
 */
export function contrastingTextColor(color: string): string {
  const luminance = getLuminance(color)
  return luminance > 0.5 ? 'black' : 'white'
}

/**
 * The relative brightness of any point in a color space,
 * normalized to 0 for darkest black and 1 for lightest white.
 * Uses MUI's `getLuminance`, but adds support for named colors
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(),
 *  hsl(), hsla(), or named color
 * @returns The relative brightness of the color in the range 0 - 1
 */
function getLuminance(color: string): number {
  const convertedColor = namedColorToHex(color)
  return muiGetLuminance(convertedColor || color)
}

/**
 * Darken or lighten a color, depending on its luminance.
 * Light colors are darkened, dark colors are lightened.
 * Uses MUI's `emphasize`, but adds support for named colors
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(),
 * hsl(), hsla(), or named color
 * @param coefficient - multiplier in the range 0 - 1, defaults to 0.15
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export function emphasize(color: string, coefficient = 0.15): string {
  const convertedColor = namedColorToHex(color)
  return muiEmphasize(convertedColor || color, coefficient)
}

export function makeContrasting(
  foreground: string,
  background = 'white',
  minContrastRatio = 3,
) {
  let convertedForeground = namedColorToHex(foreground) || foreground
  const convertedBackground = namedColorToHex(background) || background
  const backgroundLuminance = getLuminance(convertedBackground)
  let contrastRatio = getContrastRatio(convertedForeground, convertedBackground)
  const originalColor = convertedForeground
  let coefficient = 0.05
  while (contrastRatio < minContrastRatio) {
    convertedForeground =
      backgroundLuminance > 0.5
        ? darken(originalColor, coefficient)
        : lighten(originalColor, coefficient)
    coefficient += 0.05
    contrastRatio = getContrastRatio(convertedForeground, convertedBackground)
  }
  return convertedForeground
}

export { isNamedColor, namedColorToHex } from './cssColorsLevel4.ts'

/**
 * Generate a consistent random color for a given string.
 * The same string will always generate the same color, with no shared palette
 * state — so the same value (e.g. a gene symbol used as an ortholog id) gets the
 * same color across independent tracks/panels.
 *
 * @param str - The string to generate a color from
 * @returns A CSS color string in HSL format
 */
export function randomColor(str: string): string {
  // djb2 hash — much better distribution than a char-code sum (anagrams and
  // similar strings get well-separated hues).
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  const h = hash >>> 0
  const hue = h % 360
  // Vary saturation and lightness too, not just hue: a fixed S/L reads muddy
  // because it collapses the palette to one perceptual dimension (blues and
  // greens at the same S/L look alike). A separate xorshift-mixed hash (Math.imul
  // for a real 32-bit multiply — a plain `*` overflows float precision and drops
  // the low bits) picks the S/L tier independently of the hue. Tiers stay
  // mid-range so every color reads under a black-or-white label (never near
  // white/black).
  const mix = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  const s = mix % 3
  const sat = s === 0 ? 68 : s === 1 ? 82 : 58
  const l = (mix >>> 3) % 3
  const light = l === 0 ? 46 : l === 1 ? 58 : 38
  return `hsl(${hue}, ${sat}%, ${light}%)`
}
