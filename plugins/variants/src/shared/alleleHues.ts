import { ALT_HUE } from './cellFill.ts'

/**
 * The hue a haplotype's alt allele paints in phased mode, by the allele's
 * frequency rank at its site (`AlleleSummary.altOrder`): the commonest alt
 * takes the alt hue every mode paints, so a biallelic site is one blue, and
 * each alt after it its own hue. The red, green, purple, orange and pink are
 * ColorBrewer Set1's; its yellow and grey are left out for sitting on the
 * no-call and reference fills, and its brown, 15 CIEDE2000 from the red, gives
 * way to the SV preset's.
 *
 * Every pair here, and every hue against the reference, no-call and unphased
 * fills, is at least 20 CIEDE2000 apart (`alleleHues.test.ts`).
 */
export const ALLELE_HUES: readonly string[] = [
  ALT_HUE,
  '#e41a1c',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
  '#17becf',
  '#f781bf',
  '#7e6148',
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
