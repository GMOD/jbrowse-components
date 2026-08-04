import {
  NO_CALL_COLOR,
  PRIMARY_ALT_COLOR,
  REFERENCE_COLOR,
  SECONDARY_ALT_COLOR,
} from './constants.ts'

// `featureColor` sentinel selecting phase-set coloring, alongside
// CONSEQUENCE_IMPACT_JEXL and SV_TYPE_COLOR. Not a jexl expression and not a
// per-feature color like those two: phase set is a per-(feature, sample) FORMAT
// field, so `makeFeatureColor` returns no resolver for it and the worker passes
// the mode down to the cell loops instead. It shares the `featureColor` slot
// because these are all answers to "what do the alt cells mean", and only one
// can be on the screen at a time — a separate toggle would let a user select two
// and need a precedence rule to settle it.
export const PHASE_SET_COLOR = 'phaseSet'

// Whether a variant declares a phase set, i.e. carries PS in FORMAT. Gates both
// the "Color by...→Phase set" menu entry and the heavier per-sample `samples`
// read the coloring needs.
export function featureHasPhaseSet(format: string | undefined) {
  return !!format?.includes('PS')
}

// Fast-path diploid genotype split. The 3-char form "a|b" hits on the vast
// majority of human VCFs; the general split handles polyploid or multi-digit
// allele indices ("10|0") and haploid calls ("1", "23"), which come back as a
// one-element list.
export function splitPhasedAlleles(genotype: string) {
  return genotype.length === 3
    ? [genotype[0]!, genotype[2]!]
    : genotype.split('|')
}

// Whether a genotype belongs on the phased haplotype rows: it carries no `/`, so
// it is either explicitly phased ("0|1") or haploid ("1", "23") — a single allele
// has nothing left to phase, and phased expansion gives that sample exactly one
// row to draw it on.
//
// The haploid half is not a corner case. Pangenome callsets are haploid per
// assembly path (pggb / `vg deconstruct` writes bare "0"/"1"/"23"), and any file
// mixing those with diploid samples — or an ordinary human callset on chrY /
// chrM — carries both. Gating on `includes('|')` painted every haploid call with
// the black "Unphased" fill, which the legend did not even claim: `hasUnphased`
// counts only a *called* `/` genotype, so those cells had no key entry at all.
export function isPhasedOrHaploid(genotype: string) {
  return !genotype.includes('/')
}

// A genotype is a no-call when it carries no called allele — every position is
// '.' (`.`, `./.`, `.|.`, `././.`). Written as a digit scan (no allocation) so
// it's safe in the per-cell hot loops. A no-call is neither phased nor
// unphased: its `/`|`|` separator is just formatting, so callers must not treat
// it as unphased data (see detectPhased) nor render it as the "Unphased" fill.
export function isNoCall(genotype: string) {
  for (let i = 0; i < genotype.length; i++) {
    const c = genotype.charCodeAt(i)
    if (c >= 48 && c <= 57) {
      return false
    }
  }
  return true
}

// Whether a genotype carries a called non-reference allele — the fact the
// insertion-glyph pass and the cell buckets key off ("does this haplotype
// actually have the extra sequence"). The mirror of `isNoCall`'s scan: allele
// indices carry no leading zeros, so a digit 1-9 anywhere means some allele in
// the call is non-reference. Allocation-free, for the per-genotype hot path.
//
// **This has to be answered from the genotype, never from the resolved cell
// color.** The tempting `color !== NO_CALL_COLOR` test holds only for the
// functions in this file, which return the `NO_CALL_COLOR`/`REFERENCE_COLOR`
// constants by identity. `getAlleleColor` does not: it blends its no-call shade
// through colord and returns a hex, so `.` came back `#bfaa40` — never
// string-equal to the `hsl(...)` literal — and every no-call cell in
// allele-count mode was flagged alt-carrying. That is how `pangenome/maf`
// painted an insertion marker on a row the VCF calls `.` for.
export function genotypeCarriesAlt(genotype: string) {
  for (let i = 0; i < genotype.length; i++) {
    const c = genotype.charCodeAt(i)
    if (c >= 49 && c <= 57) {
      return true
    }
  }
  return false
}

// '' means "draw no cell here" — the same sentinel getAlleleColor returns, so
// the two cell-color functions can share one `if (c)` at every call site. (It
// can't be `undefined` there: getAlleleColor's memo uses `undefined` as its
// cache-miss marker, so '' has to be a cacheable value.)
export function getPhasedColor(
  alleles: string[],
  HP: number,
  mostFrequentAlt: string,
  PS?: string,
  drawReference = true,
) {
  const allele = alleles[HP]
  // The sample has no allele at this haplotype index. Phased expansion gives
  // every sample `maxPloidy` rows, so in a mixed-ploidy file — a pangenome
  // mixing haploid assembly paths with diploid samples, or chrX/chrY — a
  // diploid sample gets an HP2 row it has nothing to draw on. Draw nothing
  // there, exactly as for a sample with no genotype at the site at all. It used
  // to read past the end and paint the resulting `undefined` as
  // SECONDARY_ALT_COLOR, i.e. a phantom "other alt allele" on a haplotype the
  // sample does not have.
  if (allele === undefined) {
    return ''
  }
  if (allele === '.') {
    return NO_CALL_COLOR
  }
  if (allele === '0') {
    return drawReference ? REFERENCE_COLOR : ''
  }
  if (PS !== undefined) {
    // Hash the phase-set id to a hue. Hue is a cyclic 0-360 axis, so the wrap
    // is correct (not a bug) — the old `% 255` just truncated the wheel,
    // never emitting the 255-360 magenta/red arc. The golden-angle multiplier
    // spreads consecutive phase sets far apart instead of by a single degree.
    //
    // Rounded to whole degrees so the *string* this returns has 361 possible
    // values rather than one per phase set. Everything downstream is memoized
    // by that string — `getCachedABGR`'s cache is module-level and never
    // evicts, and it lives in a worker that outlives every fetch — so an
    // unrounded hue interned one entry (plus one `colord` parse) per distinct
    // PS, and a whole-genome phased callset has hundreds of thousands of them.
    // A degree is well under the resolution the eye reads a hue at, and two
    // phase sets landing on one hue is already inherent to a 360-slot wheel.
    const ps = +PS
    const hue = Number.isFinite(ps) ? Math.round((ps * 137.508) % 360) : 0
    return `hsl(${hue}, 50%, 50%)`
  }
  return allele === mostFrequentAlt ? PRIMARY_ALT_COLOR : SECONDARY_ALT_COLOR
}
