import {
  darken,
  emphasize as muiEmphasize,
  getContrastRatio,
  getLuminance as muiGetLuminance,
  lighten,
} from '@mui/material/styles'
import { namedColorToHex } from './cssColorsLevel4'

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

export { isNamedColor, namedColorToHex } from './cssColorsLevel4'
