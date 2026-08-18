import { BLACK_ABGR, NO_CALL_COLOR, REFERENCE_COLOR } from './constants.ts'
import { getAlleleColor } from './drawAlleleCount.ts'
import {
  altDosageByte,
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
  // 0-255 alt dosage; 0 for ref and no-call. Gates the insertion marker and
  // shades it, so a het bar draws paler than a hom one (see `altDosageByte`).
  altDosage: number
}

// One haplotype's cell, classified from the ALLELE rather than from the color
// that allele produced. Only alt-carrying cells take a per-variant override; ref
// and no-call keep their own, so a missing call is never painted as though it
// carried the variant.
//
// The allele is the input because the color is not a safe proxy for it. Reading
// `isRef`/`isAlt` back off the returned string worked only as long as every
// color function returned the `REFERENCE_COLOR` / `NO_CALL_COLOR` constants by
// identity, and the moment one blended a no-call to a hex instead, every
// no-call in that mode was flagged alt-carrying (see `altDosageByte`). Nothing
// in this file compares a color to a constant any more.
function styleForAllele(
  color: string,
  allele: string | undefined,
  overrideColor: string | undefined,
): VariantCellStyle | null {
  if (!color) {
    return null
  }
  const isRef = allele === '0'
  const isAlt = allele !== undefined && allele !== '.' && !isRef
  return {
    abgr: getCachedABGR(
      isAlt && overrideColor !== undefined ? overrideColor : color,
    ),
    isRef,
    isAlt,
    // Per HAPLOTYPE here, not per sample: a phased row either carries the allele
    // or does not, and zygosity is already readable as the pattern across a
    // sample's rows. So a drawn marker is always full strength in this mode.
    altDosage: isAlt ? 255 : 0,
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
 * `altDosage` (and so `isAlt`) comes from the genotype, not from the color: this
 * mode's dosage shades, its no-call blend and any override are all colord
 * output, so none of them is string-equal to a `NO_CALL_COLOR` /
 * `REFERENCE_COLOR` constant. `isRef` can stay on the color because "was this
 * painted with the reference fill" is exactly what decides the paint-order
 * bucket, and `getAlleleColor` returns that constant by identity for an
 * all-reference call.
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
  const altDosage = isRef ? 0 : altDosageByte(genotype)
  return {
    abgr: getCachedABGR(color),
    isRef,
    isAlt: altDosage > 0,
    altDosage,
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
      out[hp] = styleForAllele(
        getPhasedColor(alleles, hp, mostFrequentAlt, undefined, drawRef),
        alleles[hp],
        overrideColor,
      )
    }
    return out
  }
  out.fill(uncalledStyle(genotype))
  return out
}

// The two fills a genotype that isn't phased-or-haploid paints, whichever
// haplotype row it lands on. Shared, immutable and resolved once: a missing
// unphased call (`./.`, `.`) is a no-call, not unphased data, so it draws as
// no-call rather than the black "Unphased" fill.
const NO_CALL_STYLE: VariantCellStyle = {
  abgr: getCachedABGR(NO_CALL_COLOR),
  isRef: false,
  isAlt: false,
  altDosage: 0,
}
const UNPHASED_STYLE: VariantCellStyle = {
  abgr: BLACK_ABGR,
  isRef: false,
  isAlt: false,
  altDosage: 0,
}

function uncalledStyle(genotype: string) {
  return isNoCall(genotype) ? NO_CALL_STYLE : UNPHASED_STYLE
}

/**
 * The phased cell style when coloring by phase set, which is the one mode with
 * nothing site-wide to memoize: PS is a per-(feature, sample) FORMAT field, so
 * `buildPhasedStyles`' per-genotype table cannot answer for it and the color has
 * to be resolved per cell.
 *
 * Both cell loops go through this rather than each spelling out the
 * phased/no-call/unphased branch and the allele classification again. The
 * classification is the part that must not be re-derived: `isRef`/`isAlt` come
 * from the ALLELE, never from the color, and reading them back off the color
 * string is precisely what shipped a bug once the allele-count path started
 * blending its no-call shade to a hex (see `altDosageByte`).
 *
 * A factory owning one scratch style, the same shape `makePhaseSetReader` uses
 * for the PS values themselves: this runs once per cell, so returning a fresh
 * object would be an allocation per cell on the worker's hottest loop. The
 * result is therefore valid only until the next call — every caller reads it
 * straight into its cell arrays.
 */
export function makePhaseSetStyler() {
  const scratch: VariantCellStyle = {
    abgr: 0,
    isRef: false,
    isAlt: false,
    altDosage: 0,
  }
  return function phaseSetStyle(
    genotype: string,
    HP: number,
    mostFrequentAlt: string,
    phaseSet: string | number | undefined,
    drawRef: boolean,
    overrideColor: string | undefined,
  ): VariantCellStyle | null {
    if (!isPhasedOrHaploid(genotype)) {
      return uncalledStyle(genotype)
    }
    const alleles = splitPhasedAlleles(genotype)
    const allele = alleles[HP]
    const color = getPhasedColor(
      alleles,
      HP,
      mostFrequentAlt,
      phaseSet,
      drawRef,
    )
    if (!color) {
      return null
    }
    const isRef = allele === '0'
    // Only alt-carrying cells take the per-variant override; ref and no-call
    // keep their own color so a missing call is never painted as though it
    // carried the variant.
    const isAlt = allele !== undefined && allele !== '.' && !isRef
    scratch.abgr = getCachedABGR(
      isAlt && overrideColor !== undefined ? overrideColor : color,
    )
    scratch.isRef = isRef
    scratch.isAlt = isAlt
    // per haplotype in this mode, so a drawn marker is full strength; the rows
    // carry the zygosity
    scratch.altDosage = isAlt ? 255 : 0
    return scratch
  }
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
