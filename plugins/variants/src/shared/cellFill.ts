import { relight } from '@jbrowse/core/util/color'
import { colord } from '@jbrowse/core/util/colord'

/**
 * The one composition rule every genotype cell in every mode is painted by:
 * `fill = shade(hue(variant, cell), dosage)`.
 *
 * `hue` is the nominal the current color mode selects — the constant alt hue
 * below by default, an impact tier, an SV class, a phase-set hue, a plain CSS
 * color, or (in phased mode) the per-haplotype allele identity. `dosage` is the
 * fraction of CALLED alleles that are non-reference. So hue carries the
 * categorical variable and lightness carries the quantitative one, and neither
 * channel is ever asked to carry both.
 */

/**
 * Default mode's constant alt hue, at full dosage: the blue whose het is
 * `hsl(200,50%,55%)`.
 */
export const ALT_HUE = '#006084'

// The OKLCH lightness a dosage of zero would add, so a diploid het lifts by half
// of it. A fixed step, so every class color moves by the same visible amount.
const LIFT_AT_ZERO_DOSAGE = 0.42

// The lightest a lifted fill gets, so a light hue's het stops short of white.
const PALE_CEILING = 0.94

// (hue, dosage) -> the shaded fill. A parse and a re-format cost ~3 microseconds,
// and the cell loops' per-site memo resets per feature, so every het site paid
// it again. The key is the exact dosage rather than a quantized one, so the
// memo cannot move a color: a dosage is a ratio of small allele counts, which
// is a handful of distinct values per hue.
const shadedByHue = new Map<string, string>()

/**
 * One ramp for every mode: full dosage is the hue itself, and a lower dosage
 * lifts its OKLCH lightness in proportion, holding hue and chroma, up to
 * {@link PALE_CEILING}.
 */
export function shadeByDosage(hue: string, dosage: number) {
  if (dosage >= 1) {
    return hue
  }
  const key = `${hue}|${dosage}`
  let fill = shadedByHue.get(key)
  if (fill === undefined) {
    const alpha = colord(hue).alpha()
    const lifted = relight(
      hue,
      (1 - dosage) * LIFT_AT_ZERO_DOSAGE,
      1,
      PALE_CEILING,
    )
    fill = alpha < 1 ? colord(lifted).alpha(alpha).toHex() : lifted
    shadedByHue.set(key, fill)
  }
  return fill
}

/**
 * `shade(hue, dosage)` for a cell, whose dosage crosses from the worker as
 * `altDosageByte`, or the bare hue where the display turns shading off.
 */
export function cellFill(hue: string, altDosage: number, shade: boolean) {
  return shade ? shadeByDosage(hue, altDosage / 255) : hue
}

/** A diploid het's dosage as its cell carries it, `altDosageByte` of `0/1`. */
export const HET_DOSAGE = 128 / 255
