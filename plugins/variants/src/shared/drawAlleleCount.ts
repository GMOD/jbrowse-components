import { ALT_HUE, cellFill } from './cellFill.ts'
import {
  GENOTYPE_SPLITTER,
  NO_CALL_COLOR,
  REFERENCE_COLOR,
} from './constants.ts'

/**
 * One genotype's fill in allele-count mode, through the shared composition rule
 * (`shared/cellFill.ts`): the mode's hue — `altHue`, the per-variant nominal —
 * shaded by the fraction of CALLED alleles that are non-reference.
 *
 * Which alt is not on the hue here. `1/2` and `0/2` are different dosages of
 * one nominal, and a wholly uncalled genotype is the no-call category rather
 * than a blend into it: `./1` is one alt over one called allele, i.e. full
 * dosage on the haplotype that was called.
 *
 * `''` means "draw no cell here" — the same sentinel `getPhasedColor` returns,
 * so the two cell-color functions share one `if (c)` at every call site.
 * Uncached: its caller memoizes the whole resolved cell style per distinct
 * genotype string per site (`shared/variantCellStyles.ts`).
 */
export function getAlleleColor(
  genotype: string,
  drawRef = true,
  altHue = ALT_HUE,
  shade = true,
) {
  let alt = 0
  let called = 0

  const alleles =
    genotype.length === 3 && (genotype[1] === '/' || genotype[1] === '|')
      ? [genotype[0]!, genotype[2]!]
      : genotype.split(GENOTYPE_SPLITTER)
  const total = alleles.length

  for (let i = 0; i < total; i++) {
    const allele = alleles[i]!
    if (allele === '.' || allele === '') {
      continue
    }
    called++
    if (allele !== '0') {
      alt++
    }
  }

  if (called === 0) {
    return NO_CALL_COLOR
  }
  if (alt === 0) {
    return drawRef ? REFERENCE_COLOR : ''
  }
  return cellFill(altHue, alt / called, shade)
}
