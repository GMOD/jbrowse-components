import { CIGAR_D, CIGAR_I, CIGAR_N } from './cigarConstants.ts'

/** A CIGAR carries a reference skip, the `N` a spliced aligner writes across an intron. */
export const CIGAR_HAS_SKIP = 2
/** A CIGAR carries a deletion of {@link SV_INDEL_MIN_BP} or more. */
export const CIGAR_HAS_SV_DELETION = 4
/** A CIGAR carries an insertion of {@link SV_INDEL_MIN_BP} or more. */
export const CIGAR_HAS_SV_INSERTION = 8

/** The indel length from which callers file an indel as a structural variant. */
export const SV_INDEL_MIN_BP = 50

const SV_INDEL_MIN_PACKED = SV_INDEL_MIN_BP << 4

// The op count from which the branch-free scan wins. Interleaved in one
// process (`plugins/alignments/benches/categoryBits.bench.ts`), the branching
// form took 11.6 ms over 153,677 short reads against 13.5 branch-free, and
// 15.4 ms over 335 long reads of 7,300 ops against 9.7: a long read's ops mix
// in an order no predictor learns, and a short read has too few to repay the
// arithmetic.
const BRANCH_FREE_MIN_OPS = 32

/**
 * {@link CIGAR_HAS_SKIP}, {@link CIGAR_HAS_SV_DELETION} and
 * {@link CIGAR_HAS_SV_INSERTION} over a packed CIGAR (`len << 4 | op`).
 */
export function numericCigarCategoryBits(cigar: ArrayLike<number>) {
  if (cigar.length < BRANCH_FREE_MIN_OPS) {
    let bits = 0
    for (let i = 0; i < cigar.length; i++) {
      const packed = cigar[i]!
      const op = packed & 0xf
      if (op === CIGAR_N) {
        bits |= CIGAR_HAS_SKIP
      } else if (packed >= SV_INDEL_MIN_PACKED) {
        if (op === CIGAR_D) {
          bits |= CIGAR_HAS_SV_DELETION
        } else if (op === CIGAR_I) {
          bits |= CIGAR_HAS_SV_INSERTION
        }
      }
    }
    return bits
  }
  let skip = 0
  let svDeletion = 0
  let svInsertion = 0
  for (let i = 0; i < cigar.length; i++) {
    const packed = cigar[i]!
    const op = packed & 0xf
    const sv = +(packed >= SV_INDEL_MIN_PACKED)
    skip |= +(op === CIGAR_N)
    svDeletion |= +(op === CIGAR_D) & sv
    svInsertion |= +(op === CIGAR_I) & sv
  }
  return (
    (skip ? CIGAR_HAS_SKIP : 0) |
    (svDeletion ? CIGAR_HAS_SV_DELETION : 0) |
    (svInsertion ? CIGAR_HAS_SV_INSERTION : 0)
  )
}

const CHAR_D = 68
const CHAR_I = 73
const CHAR_N = 78

/**
 * {@link numericCigarCategoryBits} over a CIGAR string, walked without
 * parsing it into an array, since a synteny block's CIGAR can run to millions
 * of operations.
 */
export function cigarStringCategoryBits(cigar: string) {
  let bits = 0
  let len = 0
  for (let i = 0; i < cigar.length; i++) {
    const code = cigar.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      len = len * 10 + code - 48
    } else {
      if (code === CHAR_N) {
        bits |= CIGAR_HAS_SKIP
      } else if (len >= SV_INDEL_MIN_BP) {
        if (code === CHAR_D) {
          bits |= CIGAR_HAS_SV_DELETION
        } else if (code === CHAR_I) {
          bits |= CIGAR_HAS_SV_INSERTION
        }
      }
      len = 0
    }
  }
  return bits
}
