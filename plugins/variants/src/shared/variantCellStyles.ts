import { BLACK_ABGR, NO_CALL_COLOR, REFERENCE_COLOR } from './constants.ts'
import { getAlleleColor } from './drawAlleleCount.ts'
import {
  genotypeCarriesAlt,
  getPhasedColor,
  isNoCall,
  isPhasedOrHaploid,
  splitPhasedAlleles,
} from './getPhasedColor.ts'
import { getCachedABGR } from './variantWebglUtils.ts'

/**
 * Everything a cell loop needs to emit one cell: the packed color plus the two
 * facts the buckets and the insertion pass key off. `null` is "this genotype
 * paints nothing here" — the same answer `getPhasedColor` / `getAlleleColor`
 * spell as `''`.
 */
export interface VariantCellStyle {
  abgr: number
  isRef: boolean
  isAlt: boolean
}

// Only alt-carrying cells take a per-variant override color; ref and no-call
// keep their own, so a missing call is never painted as though it carried the
// variant.
//
// Reading `isRef`/`isAlt` back off the color is sound **only for
// `getPhasedColor`**, which returns the `REFERENCE_COLOR` / `NO_CALL_COLOR`
// constants themselves. It is not a general rule — see `genotypeCarriesAlt`,
// and `buildAlleleCountStyle` below, whose color function blends and returns a
// hex.
function styleFromColor(
  color: string,
  overrideColor: string | undefined,
): VariantCellStyle | null {
  if (!color) {
    return null
  }
  const isRef = color === REFERENCE_COLOR
  const isAlt = !isRef && color !== NO_CALL_COLOR
  return {
    abgr: getCachedABGR(
      isAlt && overrideColor !== undefined ? overrideColor : color,
    ),
    isRef,
    isAlt,
  }
}

/**
 * One genotype's style at one site, in allele-count (dosage) mode.
 *
 * Resolved per *distinct genotype string* rather than per cell. A site with
 * thousands of samples carries a handful of distinct genotypes ("0|0", "0/1",
 * "./."), so the caller memoizes this in a plain `Map` keyed by the genotype
 * string it already holds — which is what takes the packing, the ABGR lookup
 * and the allele counting out of the per-cell loop. `getAlleleColor` carried a
 * memo of its own for that job, keyed on a template literal; at this
 * granularity there is nothing left for it to save.
 *
 * `getAlleleColor` has already applied `overrideColor`, including to the
 * secondary-alt case, so nothing re-applies it here.
 *
 * `isAlt` comes from the genotype, not from the color: this mode's dosage
 * shades, its no-call blend and any override are all colord output, so none of
 * them is string-equal to a `NO_CALL_COLOR` / `REFERENCE_COLOR` constant.
 * `isRef` can stay on the color because "was this painted with the reference
 * fill" is exactly what decides the paint-order bucket, and `getAlleleColor`
 * returns that constant by identity for an all-reference call.
 */
export function buildAlleleCountStyle(
  genotype: string,
  mostFrequentAlt: string,
  drawRef: boolean,
  overrideColor: string | undefined,
): VariantCellStyle | null {
  const color = getAlleleColor(
    genotype,
    mostFrequentAlt,
    drawRef,
    overrideColor,
  )
  if (!color) {
    return null
  }
  const isRef = color === REFERENCE_COLOR
  return {
    abgr: getCachedABGR(color),
    isRef,
    isAlt: !isRef && genotypeCarriesAlt(genotype),
  }
}

/**
 * One genotype's style at one site for every haplotype row, in phased mode.
 *
 * Indexed by `HP`, so the per-cell loop is a `Map` hit plus an array read. A
 * genotype that is unphased-but-called, or a no-call, paints the same cell on
 * every haplotype row, so those fill the whole array — the mode decision is
 * made once per genotype instead of once per cell.
 *
 * `numHaplotypes` is the row count the sources ask for (max HP + 1). A sample
 * with fewer alleles than that keeps `null` at the haplotype it doesn't have —
 * mixed ploidy is routine, and drawing there would claim a haplotype the sample
 * does not carry (see `getPhasedColor`).
 *
 * Not used when coloring by phase set: PS is per-(feature, sample), so that
 * path has nothing site-wide to memoize and stays on the per-cell call.
 */
export function buildPhasedStyles(
  genotype: string,
  mostFrequentAlt: string,
  numHaplotypes: number,
  drawRef: boolean,
  overrideColor: string | undefined,
): (VariantCellStyle | null)[] {
  const out: (VariantCellStyle | null)[] = new Array(numHaplotypes)
  if (isPhasedOrHaploid(genotype)) {
    const alleles = splitPhasedAlleles(genotype)
    for (let hp = 0; hp < numHaplotypes; hp++) {
      out[hp] = styleFromColor(
        getPhasedColor(alleles, hp, mostFrequentAlt, undefined, drawRef),
        overrideColor,
      )
    }
    return out
  }
  // A missing unphased call (`./.`, `.`) is a no-call, not unphased data — draw
  // it as no-call rather than the black "Unphased" fill.
  const style: VariantCellStyle = isNoCall(genotype)
    ? { abgr: getCachedABGR(NO_CALL_COLOR), isRef: false, isAlt: false }
    : { abgr: BLACK_ABGR, isRef: false, isAlt: false }
  out.fill(style)
  return out
}

/**
 * The haplotype-row count the phased cell loops build style tables for: one
 * past the highest `HP` any source asks for. A source with no `HP` at all
 * contributes nothing and reads back `undefined` from the table, i.e. paints
 * nothing — the same answer the per-cell `getPhasedColor` gave it.
 */
export function countHaplotypes(sources: { HP?: number }[]) {
  let maxHp = -1
  for (let i = 0; i < sources.length; i++) {
    const hp = sources[i]!.HP
    if (hp !== undefined && hp > maxHp) {
      maxHp = hp
    }
  }
  return maxHp + 1
}
