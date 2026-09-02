import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

// Walks a packed CIGAR (parseCigar2 format: `(length << 4) | opIndex`) up to
// `startX` bp along the feature axis (target/ref), returning the matched
// position on both axes:
//
//   [featX, mateX] — how far we advanced on the target axis (capped at
//   startX) and the corresponding distance on the query/mate axis.
//
// Used by resolvePanel to translate a user-visible region into the matching
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
// The launch pads both ends by windowSize regardless, so this sub-insertion
// precision is immaterial in practice.
//
// M/=/X/I/D/N ops are recognized — H/S/P (clips/padding, zero-width on the
// reference) are silently skipped, which is correct for the BAM/PAF
// supplementary-alignment CIGARs this is fed (clips are stripped upstream by
// getLengthSansClipping etc.). N (skipped region / intron) consumes the
// feature/reference axis only, exactly like D, so it is handled alongside it —
// a spliced CIGAR is rare here but would otherwise mismap across the gap.
//
// A CIGAR_RUN word pair (the coarse tier's fold of a run with its small indels)
// advances the two axes in proportion, which is within the fold's `--coarse`
// gap of the alignment's real path. A run with no width on the feature axis
// behaves as the insertion it amounts to.
export function findPosInCigar(cigar: ArrayLike<number>, startX: number) {
  let featX = 0
  let mateX = 0
  for (let i = 0; i < cigar.length && featX < startX; i++) {
    const packed = cigar[i]!
    const len = packed >>> 4
    const opIdx = packed & 0xf
    const min = Math.min(len, startX - featX)
    if (opIdx === CIGAR_RUN) {
      const mateLen = cigar[++i]! >>> 4
      featX += min
      mateX += len === 0 ? mateLen : Math.round((min * mateLen) / len)
    } else if (opIdx === CIGAR_I) {
      mateX += len
    } else if (opIdx === CIGAR_D || opIdx === CIGAR_N) {
      featX += min
    } else if (opIdx === CIGAR_M || opIdx === CIGAR_EQ || opIdx === CIGAR_X) {
      mateX += min
      featX += min
    }
  }
  return [featX, mateX] as const
}

// The mirror of findPosInCigar: walk up to `startX` bp along the MATE
// (query) axis and report how far the feature axis advanced.
//
// Needed because a synteny band sits between two panels, so "move the other
// panel" runs in both directions — the panel being moved is sometimes the
// feature axis, and mapping into it is this walk rather than the one above.
// Not derivable by subtracting the forward walk from the block length: the two
// axes advance at different rates through indels, which is the entire reason a
// CIGAR walk beats interpolating across the block.
//
// Exactly the same op semantics with the axes swapped. Above, an insertion is
// zero-width on the feature axis and so consumes its whole length on the mate
// axis; here a deletion/skip is zero-width on the mate axis and consumes its
// whole length on the feature axis. The same half-open tie-break falls out: the
// loop stops once mateX reaches startX, so a deletion sitting exactly at the
// boundary is not consumed.
export function findPosInCigarByMate(cigar: ArrayLike<number>, startX: number) {
  let featX = 0
  let mateX = 0
  for (let i = 0; i < cigar.length && mateX < startX; i++) {
    const packed = cigar[i]!
    const len = packed >>> 4
    const opIdx = packed & 0xf
    if (opIdx === CIGAR_RUN) {
      const mateLen = cigar[++i]! >>> 4
      const min = Math.min(mateLen, startX - mateX)
      mateX += min
      featX += mateLen === 0 ? len : Math.round((min * len) / mateLen)
    } else {
      const min = Math.min(len, startX - mateX)
      if (opIdx === CIGAR_D || opIdx === CIGAR_N) {
        featX += len
      } else if (opIdx === CIGAR_I) {
        mateX += min
      } else if (opIdx === CIGAR_M || opIdx === CIGAR_EQ || opIdx === CIGAR_X) {
        mateX += min
        featX += min
      }
    }
  }
  return [featX, mateX] as const
}
