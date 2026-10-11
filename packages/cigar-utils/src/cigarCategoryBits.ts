import { CIGAR_D, CIGAR_N } from './cigarConstants.ts'

/** A CIGAR carries a reference skip, the `N` a spliced aligner writes across an intron. */
export const CIGAR_HAS_SKIP = 2
/** A CIGAR carries a deletion of {@link SV_DELETION_MIN_BP} or more. */
export const CIGAR_HAS_SV_DELETION = 4

/** The deletion length from which callers file a deletion as a structural variant. */
export const SV_DELETION_MIN_BP = 50

/** {@link CIGAR_HAS_SKIP} and {@link CIGAR_HAS_SV_DELETION} over a packed CIGAR (`len << 4 | op`). */
export function numericCigarCategoryBits(cigar: ArrayLike<number>) {
  let bits = 0
  for (let i = 0; i < cigar.length; i++) {
    const op = cigar[i]! & 0xf
    if (op === CIGAR_N) {
      bits |= CIGAR_HAS_SKIP
    } else if (op === CIGAR_D && cigar[i]! >>> 4 >= SV_DELETION_MIN_BP) {
      bits |= CIGAR_HAS_SV_DELETION
    }
  }
  return bits
}

const CHAR_D = 68
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
      } else if (code === CHAR_D && len >= SV_DELETION_MIN_BP) {
        bits |= CIGAR_HAS_SV_DELETION
      }
      len = 0
    }
  }
  return bits
}
