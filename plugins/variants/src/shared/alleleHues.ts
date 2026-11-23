import { ALT_HUE } from './cellFill.ts'

/**
 * The hue a haplotype's alt allele paints in phased mode, by the allele's
 * frequency rank at its site (`AlleleSummary.altOrder`): the commonest alt
 * takes the alt hue every mode paints, so a biallelic site is one blue, and
 * the second the red a triallelic site always painted. Ranks 2 to 7 (dark
 * green, lavender, salmon, mint, maroon and navy) take no color of the SV
 * type preset, since the records band above paints SV classes in those.
 *
 * Every pair here, and every hue against the reference, no-call and unphased
 * fills, is at least 20 CIEDE2000 apart, and ranks 2 to 7 are as far from
 * each SV type color (`alleleHues.test.ts`).
 */
export const ALLELE_HUES: readonly string[] = [
  ALT_HUE,
  '#e41a1c',
  '#235c36',
  '#b089e6',
  '#fb9a99',
  '#47e0b0',
  '#760a1c',
  '#0a1c76',
]

/** The slot every alt ranked past the palette shares, the rarest at a site. */
export const LAST_ALLELE_SLOT = ALLELE_HUES.length - 1

/**
 * The palette slot of the alt at `rank` in its site's order. An allele the
 * order does not hold (`indexOf`'s -1) files with the rarest.
 */
export function alleleSlot(rank: number) {
  return rank < 0 || rank > LAST_ALLELE_SLOT ? LAST_ALLELE_SLOT : rank
}

/** Whether the alt at `rank` shares the last slot with others. */
export function alleleFolds(rank: number) {
  return rank < 0 || rank > LAST_ALLELE_SLOT
}
