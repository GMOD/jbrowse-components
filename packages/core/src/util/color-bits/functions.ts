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
  // Alpha is interpolated too, and linearly — it is a coverage fraction, not a
  // gamma-encoded channel, so `gamma` has no business in it. Hardcoding 255
  // made `colord(a).mix(b)` return opaque where real colord carries the
  // operands' alpha through, on a `mix` that is public API with a colord-shaped
  // signature. Both operands opaque is byte-identical, which is every in-tree
  // caller today.
  const a = Math.round(
    getAlpha(background) * (1 - opacity) + getAlpha(overlay) * opacity,
  )
  return newColor(r, g, b, a)
}
