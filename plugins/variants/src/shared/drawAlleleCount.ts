import { ALT_HUE, cellFill } from './cellFill.ts'
import { NO_CALL_COLOR, REFERENCE_COLOR } from './constants.ts'
import { altDosageByte, isNoCall } from './getPhasedColor.ts'

/**
 * One genotype's fill in allele-count mode, through the shared composition rule
 * (`shared/cellFill.ts`): the alt hue shaded by the fraction of CALLED
 * alleles that are non-reference, as `altDosageByte` carries it. A `color`
 * hue repaints the alt cells on the main thread (`paintCellColors`).
 *
 * Which alt is not on the hue here. `1/2` and `0/2` are different dosages of
 * one nominal, and a wholly uncalled genotype is the no-call category rather
 * than a blend into it: `./1` is one alt over one called allele, i.e. full
 * dosage on the haplotype that was called.
 *
 * `''` means "draw no cell here" — the same sentinel `getPhasedColor` returns,
 * so the two cell-color functions share one `if (c)` at every call site.
 */
export function getAlleleColor(genotype: string, drawRef = true) {
  if (isNoCall(genotype)) {
    return NO_CALL_COLOR
  }
  const altDosage = altDosageByte(genotype)
  if (altDosage === 0) {
    return drawRef ? REFERENCE_COLOR : ''
  }
  return cellFill(ALT_HUE, altDosage, true)
}
