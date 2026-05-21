import {
  getAlpha,
  getBlue,
  getGreen,
  getRed,
  newColor,
  setAlpha,
} from './core.ts'

import type { Color } from './core.ts'

/**
 * Modifies color alpha channel.
 * @param color - Color
 * @param value - Value in the range [0, 1]
 */
export function alpha(color: Color, value: number): Color {
  return setAlpha(color, Math.round(value * 255))
}

/**
 * Darkens a color.
 * @param color - Color
 * @param coefficient - Multiplier in the range [0, 1]
 */
export function darken(color: Color, coefficient: number): Color {
  const r = getRed(color)
  const g = getGreen(color)
  const b = getBlue(color)
  const a = getAlpha(color)
  const factor = 1 - coefficient
  return newColor(r * factor, g * factor, b * factor, a)
}

/**
 * Lighten a color.
 * @param color - Color
 * @param coefficient - Multiplier in the range [0, 1]
 */
export function lighten(color: Color, coefficient: number): Color {
  const r = getRed(color)
  const g = getGreen(color)
  const b = getBlue(color)
  const a = getAlpha(color)
  return newColor(
    r + (255 - r) * coefficient,
    g + (255 - g) * coefficient,
    b + (255 - b) * coefficient,
    a,
  )
}

/**
 * Blend (aka mix) two colors together.
 * @param background The background color
 * @param overlay The overlay color that is affected by @opacity
 * @param opacity Opacity (alpha) for @overlay
 * @param [gamma=1.0] Gamma correction coefficient. `1.0` to match browser behavior, `2.2` for gamma-corrected blending.
 */
export function blend(
  background: Color,
  overlay: Color,
  opacity: number,
  gamma = 1,
): number {
  const blendChannel = (b: number, o: number) =>
    Math.round(
      (b ** (1 / gamma) * (1 - opacity) + o ** (1 / gamma) * opacity) ** gamma,
    )
  const r = blendChannel(getRed(background), getRed(overlay))
  const g = blendChannel(getGreen(background), getGreen(overlay))
  const b = blendChannel(getBlue(background), getBlue(overlay))
  return newColor(r, g, b, 255)
}

/**
 * The relative brightness of any point in a color space, normalized to 0 for
 * darkest black and 1 for lightest white.
 * @returns The relative brightness of the color in the range 0 - 1, with 3 digits precision
 */
export function getLuminance(color: Color) {
  const r = getRed(color) / 255
  const g = getGreen(color) / 255
  const b = getBlue(color) / 255
  const apply = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  const r1 = apply(r)
  const g1 = apply(g)
  const b1 = apply(b)
  return Math.round((0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1) * 1000) / 1000
}
