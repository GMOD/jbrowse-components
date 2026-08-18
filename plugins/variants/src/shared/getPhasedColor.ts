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

const PIPE_CODE = 124 // '|'

// Whether a variant declares a phase set, i.e. carries PS in FORMAT. Gates both
// the "Color by...→Phase set" menu entry and the heavier per-sample `samples`
// read the coloring needs.
//
// An exact match against the colon-separated field list, not a substring of it:
// FORMAT is a token list, so `includes('PS')` also answers yes to any field
// merely spelled with those two letters in it. That enables the menu entry on a
// file with no phase sets, and the coloring it then turns on reads `PS` out of
// every sample, finds nothing, and silently falls back to allele colors — a
// setting that appears to apply and does nothing.
export function featureHasPhaseSet(format: string | undefined) {
  return format?.split(':').includes('PS') ?? false
}

// Fast-path diploid genotype split. The 3-char form "a|b" hits on the vast
// majority of human VCFs; the general split handles polyploid or multi-digit
// allele indices ("10|0") and haploid calls ("1", "23"), which come back as a
// one-element list.
//
// The fast path tests for the separator, not for the length alone. A haploid
// three-digit call — "123", i.e. allele 123, which a pangenome site decomposed
// to hundreds of alts spells routinely — is also three characters, and
// splitting it positionally read it as two alleles: a phantom second haplotype
// row painted "other alt allele", and a first row colored for allele 1, which
// the sample does not carry. `buildValueTable` in anchoredHaplotypeSort splits
// the same strings with the plain `split('|')` this now falls back to.
export function splitPhasedAlleles(genotype: string) {
  return genotype.length === 3 && genotype.charCodeAt(1) === PIPE_CODE
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

// What fraction of a genotype's alleles are non-reference, as a 0-255 byte.
//
// Two jobs in one number, which is why it is a byte rather than a flag. Zero is
// "no alt here", the gate the insertion-glyph pass and the hit test already
// keyed on; above zero it is the dosage that shades the marker, so a het draws
// a paler bar than a hom — the same thing `getAltColorForDosage` does to the
// cells underneath.
//
// 255 for a haploid alt, matching `readAltDosages`' ploidy-invariance: one
// allele out of one is full dosage, not half. A `.` allele counts toward the
// denominator, so `./1` is half — the sample carries the sequence on the one
// haplotype that was called.
//
// **This has to be answered from the genotype, never from the resolved cell
// color.** The tempting `color !== NO_CALL_COLOR` test holds only for the
// functions in this file, which return the `NO_CALL_COLOR`/`REFERENCE_COLOR`
// constants by identity. `getAlleleColor` does not: it blends its no-call shade
// through colord and returns a hex, so `.` came back `#bfaa40` — never
// string-equal to the `hsl(...)` literal — and every no-call cell in
// allele-count mode was flagged alt-carrying. That is how `pangenome/maf`
// painted an insertion marker on a row the VCF calls `.` for.
export function altDosageByte(genotype: string) {
  let alt = 0
  let total = 0
  let alleleIsAlt = false
  let inAllele = false
  for (let i = 0; i <= genotype.length; i++) {
    const c = i < genotype.length ? genotype.charCodeAt(i) : 47
    // '/' or '|' ends an allele; so does the end of the string
    if (c === 47 || c === 124) {
      if (inAllele) {
        total++
        if (alleleIsAlt) {
          alt++
        }
      }
      alleleIsAlt = false
      inAllele = false
    } else {
      inAllele = true
      // any digit 1-9 makes the allele non-reference: allele indices carry no
      // leading zeros, so "10" is alt and "0" is not
      if (c >= 49 && c <= 57) {
        alleleIsAlt = true
      }
    }
  }
  return total === 0 ? 0 : Math.round((255 * alt) / total)
}

// '' means "draw no cell here" — the same sentinel getAlleleColor returns, so
// the two cell-color functions can share one `if (c)` at every call site. (It
// can't be `undefined` there: getAlleleColor's memo uses `undefined` as its
// cache-miss marker, so '' has to be a cacheable value.)
export function getPhasedColor(
  alleles: string[],
  HP: number,
  mostFrequentAlt: string,
  // `string | number` because that is what a FORMAT field actually deserializes
  // to: the VCF spec reserves PS as Type=Integer, so @gmod/vcf hands back a
  // number, and a phase-set id written as a string is equally legal. Coerced
  // below either way.
  PS?: string | number,
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
