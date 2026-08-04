import { colord } from '@jbrowse/core/util/colord'

import {
  GENOTYPE_SPLITTER,
  NO_CALL_COLOR,
  OTHER_ALT_COLOR,
  REFERENCE_COLOR,
  getAltColorForDosage,
} from './constants.ts'

// The dosage color for one genotype. '' means "draw no cell here" — the same
// sentinel getPhasedColor returns, so the two cell-color functions share one
// `if (c)` at every call site.
//
// Uncached: its one caller memoizes the whole resolved cell style per distinct
// genotype string per site (see shared/variantCellStyles.ts), so this now runs
// a handful of times per variant rather than once per cell. The memo it used to
// carry keyed on `${genotype}:${mostFrequentAlt}:${altOverride}` — a string
// allocation on the per-cell path, and a key that silently left out `drawRef`,
// so a cache shared across two reference-drawing modes would have answered from
// the wrong one.
export function getAlleleColor(
  genotype: string,
  mostFrequentAlt: string,
  drawRef = true,
  // Consequence / SV-type mode: paint alt-carrying cells with this color
  // instead of the allele-dosage shade.
  altOverride?: string,
) {
  let alt = 0
  let uncalled = 0
  let alt2 = 0
  let ref = 0

  const alleles =
    genotype.length === 3 && (genotype[1] === '/' || genotype[1] === '|')
      ? [genotype[0]!, genotype[2]!]
      : genotype.split(GENOTYPE_SPLITTER)
  const total = alleles.length

  for (let i = 0; i < total; i++) {
    const allele = alleles[i]!
    if (allele === mostFrequentAlt) {
      alt++
    } else if (allele === '0') {
      ref++
    } else if (allele === '.') {
      uncalled++
    } else {
      alt2++
    }
  }
  return getColorAlleleCount(
    ref,
    alt,
    alt2,
    uncalled,
    total,
    drawRef,
    altOverride,
  )
}

function getColorAlleleCount(
  ref: number,
  alt: number,
  alt2: number,
  uncalled: number,
  total: number,
  drawReference = true,
  altOverride?: string,
) {
  if (ref === total) {
    return drawReference ? REFERENCE_COLOR : ''
  }

  if (!(alt || alt2 || uncalled)) {
    return ''
  }

  // Per-variant override (consequence impact / SV type): any alt-carrying cell
  // (primary or secondary) takes the override color flat, so the class/impact
  // color reads at full strength (dosage shading washed out the majority tier).
  // No-call-only cells fall through to no-call shading, so a missing genotype is
  // never mistaken for carrying the variant.
  if (altOverride !== undefined && (alt || alt2)) {
    return altOverride
  }

  // A non-primary ("other") alt is drawn as a single flat flag color regardless
  // of the rest of the genotype: the point is to flag "this sample carries a
  // secondary alt here", and dosage-blending it made that same signal render at
  // different strengths (faint when mixed with a primary alt, solid when
  // homozygous). Flagging wins over dosage/no-call shading.
  if (alt2) {
    return OTHER_ALT_COLOR
  }

  // The alt2 return above plus the `alt || alt2 || uncalled` guard leave only
  // two live cases here: some primary alt, and/or some no-call.
  if (uncalled) {
    const alpha = uncalled / total
    const noCall = NO_CALL_COLOR.replace(')', `,${alpha})`).replace(
      'hsl',
      'hsla',
    )
    // Weight the no-call blend by its dosage (mix ratio), not a fixed 0.5.
    return (
      alt
        ? colord(getAltColorForDosage(alt / total)).mix(noCall, alpha)
        : colord(noCall)
    ).toHex()
  }
  return colord(getAltColorForDosage(alt / total)).toHex()
}
