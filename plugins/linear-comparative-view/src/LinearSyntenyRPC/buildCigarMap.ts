import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

// Two Uint32Arrays of this length are 32KB, which is what one of these costs on
// the wire. A chromosome-scale CIGAR runs to tens of megabytes, so the point of
// the budget is that the map's size is a property of the BUDGET and not of the
// alignment: a 30Mb block and a 3kb one both ship this.
const MAX_POINTS = 4096

// Below a base there is nothing left to resolve — the map exists to place a
// row, and a row is placed in pixels.
const MIN_TOLERANCE_BP = 1

/**
 * A piecewise-linear index of one alignment's CIGAR: the offsets, from the
 * block's own start on each axis, of the points where the two axes'
 * correspondence bends.
 *
 * BOTH ARRAYS ARE ASCENDING AND THE SAME LENGTH, and entry `i` of each is one
 * point. `featOffsets` starts at 0 and ends at the block's span on the feature
 * axis; `mateOffsets` likewise on the mate axis, counted along the WALK — so a
 * reverse-strand block's mate offsets still ascend, and the caller turns them
 * back into coordinates the way `resolveAlignmentSpan` does.
 *
 * Neither array is strictly ascending: a run of insertions advances the mate
 * axis while the feature axis stands still, and the reverse for deletions.
 */
export interface CigarMap {
  featOffsets: Uint32Array
  mateOffsets: Uint32Array
  // The bp either axis can be out by between two points. Exact AT a point.
  toleranceBp: number
}

/**
 * Total indel bases in a CIGAR — how far the two axes drift apart and back over
 * the whole block, which is the budget the point spacing is bought out of. A
 * coarse fold's run drifts by the difference of its two lengths.
 */
function skewVariation(cigar: ArrayLike<number>) {
  let total = 0
  for (let i = 0; i < cigar.length; i++) {
    const packed = cigar[i]!
    const op = packed & 0xf
    if (op === CIGAR_RUN) {
      total += Math.abs((packed >>> 4) - (cigar[++i]! >>> 4))
    } else if (op === CIGAR_I || op === CIGAR_D || op === CIGAR_N) {
      total += packed >>> 4
    }
  }
  return total
}

/**
 * Reduce one alignment's CIGAR to a map the main thread can walk per frame.
 *
 * THE POINT IS THAT THE FOLLOW STOPS ASKING. Placing a row between the settled
 * resolves used to be a two-point affine fit (`followTransform`) extrapolated
 * off the last answer, so the row drifted by whatever indels lay between the
 * window the fit was measured over and the window the user had panned to, and
 * the next settle corrected it as a visible snap. Panning inside one
 * chromosome-scale block is the case the follow was built for, and it is the
 * case that fit is worst at.
 *
 * A point goes down wherever the two axes' offset has moved more than
 * `toleranceBp` since the last one, AND on both sides of any single op that
 * moves it that far. The second half is what keeps a large indel a STEP rather
 * than a smear across the surrounding matches — a 5kb deletion is exactly what
 * a user navigating a CIGAR is looking at — and it is also what bounds the
 * error, since without it one op could carry a segment arbitrarily far.
 *
 * Between two points the caller interpolates, and the true correspondence is
 * within `2 * toleranceBp` of that line: the skew stays within `toleranceBp` of
 * each endpoint's, and the line runs between them.
 *
 * The tolerance is DERIVED, not configured: an indel-free block gets two points
 * and is exact, and a block with more bends than the budget gets them spread
 * evenly over its drift rather than a truncated prefix of them.
 */
export function buildCigarMap(
  cigar: ArrayLike<number>,
  {
    maxPoints = MAX_POINTS,
    minToleranceBp = MIN_TOLERANCE_BP,
  }: { maxPoints?: number; minToleranceBp?: number } = {},
): CigarMap {
  // Two points per bend in the worst case (before and after a large op), so the
  // budget is halved rather than the emit rule being weakened.
  const toleranceBp = Math.max(
    minToleranceBp,
    (2 * skewVariation(cigar)) / Math.max(1, maxPoints),
  )

  const feat: number[] = [0]
  const mate: number[] = [0]
  let featX = 0
  let mateX = 0
  let lastSkew = 0

  const emit = () => {
    // A second point at the same place says nothing, and a pure-insertion run
    // would otherwise put one down per op
    if (feat.at(-1) !== featX || mate.at(-1) !== mateX) {
      feat.push(featX)
      mate.push(mateX)
      lastSkew = featX - mateX
    }
  }

  for (let i = 0; i < cigar.length; i++) {
    const packed = cigar[i]!
    const len = packed >>> 4
    const op = packed & 0xf
    const bends = op === CIGAR_I || op === CIGAR_D || op === CIGAR_N
    // the op's own two sides, so a big one is a step. Its leading side is only
    // worth a point if the run up to it has not already put one down.
    if (bends && len > toleranceBp) {
      emit()
    }
    if (op === CIGAR_RUN) {
      // the fold's run: linear inside, so both its ends are exact points, and
      // a run that leans by more than the tolerance is a bend at both — the
      // same two-sided rule as a large indel, since a line drawn from before
      // the run to its far end would be off by the whole lean
      const mateLen = cigar[++i]! >>> 4
      const leans = Math.abs(len - mateLen) > toleranceBp
      if (leans) {
        emit()
      }
      featX += len
      mateX += mateLen
      if (leans || Math.abs(featX - mateX - lastSkew) > toleranceBp) {
        emit()
      }
    } else if (op === CIGAR_I) {
      mateX += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      featX += len
    } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
      featX += len
      mateX += len
    }
    // H/S/P advance neither axis, matching findPosInCigar
    if (
      bends &&
      (len > toleranceBp || Math.abs(featX - mateX - lastSkew) > toleranceBp)
    ) {
      emit()
    }
  }
  emit()

  return {
    featOffsets: Uint32Array.from(feat),
    mateOffsets: Uint32Array.from(mate),
    toleranceBp,
  }
}
