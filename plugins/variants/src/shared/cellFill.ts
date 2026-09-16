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

/** Default mode's constant alt hue, at full dosage. */
export const ALT_HUE = 'hsl(200,50%,30%)'

// Where a dosage of zero would land. The ramp interpolates lightness between
// the hue's own lightness (full dosage) and this ceiling, so a hue already
// lighter than it is left alone and no class color can wash out past a fixed
// bound.
const PALE_LIGHTNESS = 80

/**
 * One ramp for every mode: full dosage is the hue itself, and a lower dosage
 * lifts its lightness toward {@link PALE_LIGHTNESS} in proportion. A diploid het
 * of the default hue comes out at `hsl(200,50%,55%)` and its hom at
 * `hsl(200,50%,30%)`, which is where they have always been.
 */
export function shadeByDosage(hue: string, dosage: number) {
  if (dosage >= 1) {
    return hue
  }
  const { h, s, l } = colord(hue).toHsl()
  const lifted = l + (1 - dosage) * Math.max(0, PALE_LIGHTNESS - l)
  return colord({ h, s, l: lifted }).toHex()
}

/** `shade(hue, dosage)`, or the bare hue where the display turns shading off. */
export function cellFill(hue: string, dosage: number, shade: boolean) {
  return shade ? shadeByDosage(hue, dosage) : hue
}
