import { categoricalColorScale, refNameColor } from '@jbrowse/core/ui/colors'
import { tagColorPalette } from '@jbrowse/core/ui/palette'
import { relight } from '@jbrowse/core/util/color'

import type { HeldSlots } from '@jbrowse/core/ui/colors'

/**
 * Where a refName sits in its assembly's own chromosome order, for chromosome
 * painting — the display's `paintedRefNamePosition`, which canonicalizes the
 * name first because a mate reference arrives in the FILE's spelling. Undefined
 * for every other field, and while the assembly is still loading, where
 * `refNameColor` falls back to its hash.
 */
export type RefNamePosition = (refName: string) => number | undefined

// Laps only darken: tol_light has no room to go lighter against the track
// background.
const TAG_PALETTE_LAP_TONES = [
  undefined,
  { lightnessShift: -0.18, chromaScale: 1.35 },
  { lightnessShift: -0.36, chromaScale: 1.7 },
]

/**
 * The 30 colors a tag value is dealt from: the pale tag palette, so a read stays
 * lighter than the mismatches drawn over it, then two darker laps of its ten
 * hues. A non-negative integer takes the slot it names anchored at 1, so HP:1 is
 * the leading blue and HP:0, unphased where it appears, the far end.
 */
export const TAG_PALETTE = TAG_PALETTE_LAP_TONES.flatMap(lap =>
  tagColorPalette.map(hex =>
    lap ? relight(hex, lap.lightnessShift, lap.chromaScale) : hex,
  ),
)

/**
 * The color a value of a field with no declared colors paints, read by the bake
 * and the key alike so a swatch is the color drawn.
 *
 * A tag or attribute value is dealt a slot of `TAG_PALETTE` on first sight into
 * `held` (ADR-205), so values on screen together take colors that read apart
 * while the palette has room, and a value nothing collides with keeps the slot
 * its own hash names.
 *
 * A mate reference takes `refNameColor`, the palette handed out by assembly
 * position, which is how the synteny and dotplot views paint a query contig, so
 * one contig takes one color wherever it is drawn. Hashing the name instead
 * painted chr1, chr12, chr21 and chrY one color on hg38, hiding a translocation
 * to chr12 from a chr1 view.
 */
export function undeclaredValueColor(
  colorField: string | undefined,
  refNamePosition?: RefNamePosition,
  held?: HeldSlots,
): (value: string) => string {
  return colorField === 'mateRefName'
    ? value => refNameColor(value, refNamePosition?.(value))
    : categoricalColorScale(undefined, TAG_PALETTE, held)
}

const INTEGER_VALUE = /^-?\d+$/

/**
 * The order a set of baked values is listed and dealt in: "1, 2, 10" and not
 * "1, 10, 2", as HP, NM and cluster ids are numbers written as text, but only
 * when every value is an integer, so a mixed vocabulary keeps one order.
 */
export function bakedValueOrder(values: readonly string[]) {
  return values.every(value => INTEGER_VALUE.test(value))
    ? (a: string, b: string) => Number(a) - Number(b)
    : (a: string, b: string) => a.localeCompare(b)
}
