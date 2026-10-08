import { ALT_HUE } from './cellFill.ts'
import {
  NO_CALL_COLOR,
  REFERENCE_COLOR,
  SECONDARY_ALT_COLOR,
} from './constants.ts'

// The color preset field for the phase set. A FORMAT value, per (feature,
// sample), so the worker hands the cell loops a flag rather than a per-variant
// resolver.
export const PHASE_SET_FIELD = 'phaseSet'

// The band the phase-set wheel spins in, off the one the absent-data colors sit
// on: no-call is `hsl(50,50%,50%)`, which a 50%/50% wheel lands on exactly.
const PS_SATURATION = 65
const PS_LIGHTNESS = 42

const PIPE_CODE = 124 // '|'

// Whether a variant carries PS in FORMAT. An exact match against the
// colon-separated list: `includes('PS')` also matches any field spelled with
// those two letters.
export function featureHasPhaseSet(format: string | undefined) {
  return format?.split(':').includes('PS') ?? false
}

// Fast-path diploid split of the 3-char "a|b". It tests for the separator, not
// the length alone: a haploid "123" is also three characters.
export function splitPhasedAlleles(genotype: string) {
  return genotype.length === 3 && genotype.charCodeAt(1) === PIPE_CODE
    ? [genotype[0]!, genotype[2]!]
    : genotype.split('|')
}

// Whether a genotype belongs on the phased haplotype rows: it carries no `/`,
// so it is phased ("0|1") or haploid ("1"), which pangenome callsets and
// chrY/chrM are. A homozygous `1/1` is unphased too: phased mode draws what the
// file phased.
export function isPhasedOrHaploid(genotype: string) {
  return !genotype.includes('/')
}

// A genotype with no called allele (`.`, `./.`, `.|.`), which is neither phased
// nor unphased. A digit scan, allocation-free for the per-cell loops.
export function isNoCall(genotype: string) {
  for (let i = 0; i < genotype.length; i++) {
    const c = genotype.charCodeAt(i)
    if (c >= 48 && c <= 57) {
      return false
    }
  }
  return true
}

// The fraction of a genotype's CALLED alleles that are non-reference, as a
// 0-255 byte: the `dosage` of `shared/cellFill.ts`. Zero gates the insertion
// marker and above zero shades it. A `.` allele leaves the denominator, so a
// haploid alt and `./1` are both full dosage.
export function altDosageByte(genotype: string) {
  let alt = 0
  let called = 0
  let alleleIsAlt = false
  let alleleIsCalled = false
  for (let i = 0; i <= genotype.length; i++) {
    const c = i < genotype.length ? genotype.charCodeAt(i) : 47
    // '/' or '|' ends an allele; so does the end of the string
    if (c === 47 || c === 124) {
      if (alleleIsCalled) {
        called++
        if (alleleIsAlt) {
          alt++
        }
      }
      alleleIsAlt = false
      alleleIsCalled = false
    } else if (c >= 48 && c <= 57) {
      alleleIsCalled = true
      // any digit 1-9 makes the allele non-reference: allele indices carry no
      // leading zeros, so "10" is alt and "0" is not
      if (c >= 49) {
        alleleIsAlt = true
      }
    }
  }
  return called === 0 ? 0 : Math.round((255 * alt) / called)
}

// '' means "draw no cell here", the sentinel getAlleleColor returns; its memo
// uses `undefined` for a cache miss.
export function getPhasedColor(
  alleles: string[],
  HP: number,
  mostFrequentAlt: string,
  // PS is Type=Integer in the spec and a string id is equally legal
  PS?: string | number,
  drawReference = true,
) {
  const allele = alleles[HP]
  // The sample has no allele at this haplotype index: phased expansion gives
  // every sample `maxPloidy` rows, and a diploid sample has nothing for HP2.
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
    // Hash the phase-set id to a hue by the golden angle, rounded to whole
    // degrees: everything downstream memoizes by this string in a worker that
    // never evicts, and a phased genome has hundreds of thousands of phase
    // sets.
    const ps = +PS
    const hue = Number.isFinite(ps) ? Math.round((ps * 137.508) % 360) : 0
    return `hsl(${hue}, ${PS_SATURATION}%, ${PS_LIGHTNESS}%)`
  }
  return allele === mostFrequentAlt ? ALT_HUE : SECONDARY_ALT_COLOR
}
