import { CIGAR_N } from './cigarConstants.ts'

// Whether a packed CIGAR (`len << 4 | op`) carries a reference skip — the `N`
// a spliced aligner writes across an intron.
export function numericCigarHasSkip(cigar: ArrayLike<number>) {
  for (let i = 0; i < cigar.length; i++) {
    if ((cigar[i]! & 0xf) === CIGAR_N) {
      return true
    }
  }
  return false
}
