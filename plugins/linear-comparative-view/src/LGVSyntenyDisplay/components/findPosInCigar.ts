import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

// Walks a packed CIGAR (parseCigar2 format: `(length << 4) | opIndex`) up to
// `startX` bp along the feature axis (target/ref), returning the matched
// position on both axes:
//
//   [featX, mateX] — how far we advanced on the target axis (capped at
//   startX) and the corresponding distance on the query/mate axis.
//
// Used by navToSynteny to translate a user-visible region into the matching
// mate region via CIGAR walk. Note: insertions encountered before reaching
// `startX` advance the mate but are NOT consumed at exactly featX === startX
// (the loop breaks first); this is intentional so a region boundary doesn't
// "absorb" a leading insertion on the next iteration's lookup.
//
// Only M/=/X/I/D ops are recognized — H/S/P/N are silently skipped, which is
// correct for the BAM/PAF supplementary-alignment CIGARs this is fed (clips
// are stripped upstream by getLengthSansClipping etc.).
export function findPosInCigar(cigar: number[], startX: number) {
  let featX = 0
  let mateX = 0
  for (const packed of cigar) {
    if (featX >= startX) {
      break
    }
    const len = packed >>> 4
    const opIdx = packed & 0xf
    const min = Math.min(len, startX - featX)
    if (opIdx === CIGAR_I) {
      mateX += len
    } else if (opIdx === CIGAR_D) {
      featX += min
    } else if (opIdx === CIGAR_M || opIdx === CIGAR_EQ || opIdx === CIGAR_X) {
      mateX += min
      featX += min
    }
  }
  return [featX, mateX] as const
}
