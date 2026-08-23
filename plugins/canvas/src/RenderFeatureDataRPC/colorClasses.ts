import { alpha, lighten } from '@jbrowse/core/ui/palette'
import {
  cssColorToABGR,
  formatHEX,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * A color the worker cannot resolve because it comes from the active theme.
 *
 * The worker bakes every other color it emits — a config `color` slot, a jexl
 * callback, a BED `itemRgb`, a fixed per-type fill — because only it has the
 * feature to evaluate them against. Theme colors are the opposite: they depend
 * on nothing the worker has and change without the data changing. So a
 * theme-derived primitive ships a CLASS here and a zero in its color lane, and
 * the main-thread encode fills the lane in from `themedColorTable`. That is
 * what keeps a light/dark toggle a re-encode instead of a refetch of every
 * visible region.
 *
 * `LITERAL` is 0, so an all-zero class lane means "nothing in this region is
 * themed" and the encode hands the worker's own array straight back.
 *
 * The frames are in `Frame` order (`getFrame`: +1..+3 forward, -1..-3
 * reverse), and each carries the two codon tints beside it because
 * `emitCodonRects` alternates `lighten(base, 0.5)` / `lighten(base, 0.35)` down
 * a CDS — a derivation of the frame color, so it has to be a class of its own
 * rather than a literal computed from a color the worker no longer holds.
 */
export const LITERAL = 0
export const STROKE = 1
export const OUTLINE = 2
const FIRST_FRAME = 3
const FRAMES = [1, 2, 3, -1, -2, -3]
// The two tint blocks sit one whole frame set apart, so a tint is the solid
// class plus a fixed stride — see `codonStripeClass`.
const LIGHT_TINT = FRAMES.length
const MID_TINT = FRAMES.length * 2
export const COLOR_CLASS_COUNT = FIRST_FRAME + FRAMES.length * 3

/**
 * The class for a CDS box painted by reading frame, or `LITERAL` for a frame
 * outside `getFrame`'s range — which is where the box keeps whatever color the
 * config resolved for it.
 */
export function cdsFrameClass(frame: number) {
  const i = FRAMES.indexOf(frame)
  return i < 0 ? LITERAL : FIRST_FRAME + i
}

function isCdsFrameClass(colorClass: number) {
  return colorClass >= FIRST_FRAME && colorClass < FIRST_FRAME + FRAMES.length
}

/**
 * The class for one codon stripe over a box of class `boxClass`. A literal box
 * color stays literal — the emitter lightens the color it holds — and only a
 * frame-colored box needs a tint class, because its base is the theme's.
 */
export function codonStripeClass(boxClass: number, odd: boolean) {
  return isCdsFrameClass(boxClass)
    ? boxClass + (odd ? MID_TINT : LIGHT_TINT)
    : LITERAL
}

/**
 * Feature-box outline when the `outlineColor` slot holds THEME_DERIVED_COLOR:
 * the theme's text color at low alpha, so the outline stays visible on a dark
 * track too (a fixed black outline vanishes there). In light mode this is the
 * old black-0.3.
 */
function faintOutline(palette: JBrowsePalette) {
  return alpha(palette.text.primary, 0.3)
}

/**
 * Every themed color, packed, indexed by class. Built once per palette on the
 * main thread and read by the encode; `LITERAL`'s entry is never read.
 */
export function themedColorTable(palette: JBrowsePalette) {
  const table = new Uint32Array(COLOR_CLASS_COUNT)
  table[STROKE] = cssColorToABGR(palette.text.secondary)
  table[OUTLINE] = cssColorToABGR(faintOutline(palette))
  for (const [i, frame] of FRAMES.entries()) {
    const solid = palette.framesCDS.at(frame)!.main
    const hex = formatHEX(parseCssColor(solid))
    table[FIRST_FRAME + i] = cssColorToABGR(solid)
    table[FIRST_FRAME + i + LIGHT_TINT] = cssColorToABGR(lighten(hex, 0.5))
    table[FIRST_FRAME + i + MID_TINT] = cssColorToABGR(lighten(hex, 0.35))
  }
  return table
}

/**
 * One primitive lane resolved against the table. Returns the worker's own array
 * when nothing in it is themed, so an unthemed region re-encodes to the
 * identical reference and the upload diff skips it.
 */
export function resolveColorLane(
  colors: Uint32Array,
  classes: Uint8Array,
  table: Uint32Array,
) {
  let out: Uint32Array | undefined
  for (let i = 0; i < classes.length; i++) {
    const colorClass = classes[i]!
    if (colorClass !== LITERAL) {
      out ??= new Uint32Array(colors)
      out[i] = table[colorClass]!
    }
  }
  return out ?? colors
}
