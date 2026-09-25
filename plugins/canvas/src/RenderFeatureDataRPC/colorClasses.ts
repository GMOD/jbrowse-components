import { alpha, lighten } from '@jbrowse/core/ui/palette'
import {
  cssColorToABGR,
  formatHEX,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * A color the worker cannot resolve because it comes from the active theme: the
 * primitive ships a CLASS here and a zero color lane, and the main-thread
 * encode fills the lane in, so a light/dark toggle is a re-encode rather than a
 * refetch. `LITERAL` is 0, so an all-zero class lane means nothing here is
 * themed.
 */
export const LITERAL = 0
export const STROKE = 1
export const OUTLINE = 2
const FIRST_FRAME = 3
const FRAMES = [1, 2, 3, -1, -2, -3]
// The two tint blocks sit one whole frame set apart, so a tint is the solid
// class plus a fixed stride.
const LIGHT_TINT = FRAMES.length
const MID_TINT = FRAMES.length * 2
const COLOR_CLASS_COUNT = FIRST_FRAME + FRAMES.length * 3

/**
 * A codon stripe over a box the color field paints: the field's color,
 * lightened as a stripe over a literal box is. The class lane carries it
 * beside the box's value, and the literal it falls back to while no field
 * paints is already lightened in the color lane.
 */
export const FIELD_LIGHT_TINT = COLOR_CLASS_COUNT
export const FIELD_MID_TINT = COLOR_CLASS_COUNT + 1

function isThemeClass(colorClass: number) {
  return colorClass !== LITERAL && colorClass < COLOR_CLASS_COUNT
}

function fieldTintOf(colorClass: number) {
  return colorClass === FIELD_LIGHT_TINT
    ? 1
    : colorClass === FIELD_MID_TINT
      ? 2
      : 0
}

function isFieldTint(colorClass: number) {
  return colorClass === FIELD_LIGHT_TINT || colorClass === FIELD_MID_TINT
}

/**
 * The colors a color field's values paint, `paint` being its scale: each
 * value's packed color and its two codon tints, resolved once for the
 * palette's life however many regions and re-encodes ask for them. `field`
 * is the field it paints, which a region's values have to name to be painted
 * by it.
 */
export function createFieldPalette(
  field: string,
  paint: (value: string) => string,
) {
  const solid = new Map<string, number>()
  const tints = new Map<string, readonly [number, number]>()
  const solidOf = (value: string) => {
    let packed = solid.get(value)
    if (packed === undefined) {
      packed = cssColorToABGR(paint(value))
      solid.set(value, packed)
    }
    return packed
  }
  // Through the hex, as a stripe over a literal box is lightened in the worker.
  const tintsOf = (value: string) => {
    let pair = tints.get(value)
    if (pair === undefined) {
      const hex = formatHEX(parseCssColor(paint(value)))
      pair = [
        cssColorToABGR(lighten(hex, 0.5)),
        cssColorToABGR(lighten(hex, 0.35)),
      ]
      tints.set(value, pair)
    }
    return pair
  }
  return {
    field,
    paint,
    /**
     * Three words a value, its color and its light and mid tints, the tints
     * only where `withTints` says a stripe will read them.
     */
    tableOf(values: readonly string[], withTints: boolean) {
      const table = new Uint32Array(values.length * 3)
      for (const [i, value] of values.entries()) {
        table[i * 3] = solidOf(value)
        if (withTints) {
          const [light, mid] = tintsOf(value)
          table[i * 3 + 1] = light
          table[i * 3 + 2] = mid
        }
      }
      return table
    },
  }
}

export type FieldPalette = ReturnType<typeof createFieldPalette>

/** Whether a class lane holds a stripe the field's tints paint. */
export function carriesFieldTints(classes: Uint8Array) {
  return classes.some(isFieldTint)
}

/**
 * `LITERAL` for a frame outside `getFrame`'s range, where the box keeps
 * whatever color the config resolved for it.
 */
export function cdsFrameClass(frame: number) {
  const i = FRAMES.indexOf(frame)
  return i < 0 ? LITERAL : FIRST_FRAME + i
}

function isCdsFrameClass(colorClass: number) {
  return colorClass >= FIRST_FRAME && colorClass < FIRST_FRAME + FRAMES.length
}

/**
 * Only a frame-colored box needs a tint class, because its base is the theme's;
 * over a literal box the emitter lightens the color it already holds.
 */
export function codonStripeClass(boxClass: number, odd: boolean) {
  return isCdsFrameClass(boxClass)
    ? boxClass + (odd ? MID_TINT : LIGHT_TINT)
    : LITERAL
}

/**
 * The theme's text color at low alpha, so the outline stays visible on a dark
 * track, where a fixed black outline vanishes.
 */
function faintOutline(palette: JBrowsePalette) {
  return alpha(palette.text.primary, 0.3)
}

/**
 * Every themed color, packed, indexed by class. `LITERAL`'s entry is never
 * read.
 */
export function themedColorTable(palette: JBrowsePalette) {
  const table = new Uint32Array(COLOR_CLASS_COUNT)
  table[STROKE] = cssColorToABGR(palette.featureConnector)
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
 * Returns the worker's own array when nothing in it is themed or painted by
 * the field, so such a region re-encodes to the identical reference and the
 * upload diff skips it. `fieldTable` is absent while no field paints, and the
 * value lane is then ignored.
 */
export function resolveColorLane(
  colors: Uint32Array,
  classes: Uint8Array,
  table: Uint32Array,
  values?: Uint32Array,
  fieldTable?: Uint32Array,
) {
  const byValue = fieldTable && values && values.length > 0 ? values : undefined
  let out: Uint32Array | undefined
  const n = Math.max(classes.length, byValue?.length ?? 0)
  for (let i = 0; i < n; i++) {
    const colorClass = classes.length > 0 ? classes[i]! : LITERAL
    const value = byValue ? byValue[i]! : 0
    if (value > 0) {
      out ??= new Uint32Array(colors)
      out[i] = fieldTable![(value - 1) * 3 + fieldTintOf(colorClass)]!
    } else if (isThemeClass(colorClass)) {
      out ??= new Uint32Array(colors)
      out[i] = table[colorClass]!
    }
  }
  return out ?? colors
}
