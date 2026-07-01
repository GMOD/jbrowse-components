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
// mate region via CIGAR walk.
//
// Insertion-at-the-boundary rule: an insertion is zero-width on the feature
// axis, so a feature-offset that lands exactly on one maps ambiguously to
// either the mate position before or after it. We break that tie the half-open
// `[start, end)` way — the loop stops once featX reaches startX, before an
// insertion sitting at startX is seen, so it is NOT consumed. Mapping a
// region's start therefore keeps a leading insertion (start lands to its
// left); mapping its end drops a trailing insertion (end lands to its left).
// Adjacent regions thus never double-count or drop a boundary insertion.
// navToSynteny pads both ends by windowSize regardless, so this sub-insertion
// precision is immaterial in practice.
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
