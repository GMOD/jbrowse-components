import type { DerivativeSegment } from './computePaths.ts'

// The notation SV papers write a complex rearrangement in (Carvalho & Lupski
// 2016, Nat Rev Genet 17:224): the reference is cut into lettered pieces at
// every breakpoint, and the derivative is the string of letters it carries, a
// prime on a piece traversed against the reference. `A B C D E′ B′` says at a
// glance what `3 → 10 → 12 (inverted) → 3 (inverted)` does not — that B is
// carried twice, once each way, so the event is an inverted duplication.
//
// Pieces are cut at every edge of every segment on a chromosome, not only at
// the junctions, so the two chr3 arms of COLO829's der(3) share their letters:
// the inner edge of the returning arm splits the outgoing one into A B | C.

export interface ReferencePiece {
  letter: string
  refName: string
  start: number
  end: number
  /**
   * How many path segments carry this piece, in either orientation. 0 is
   * reference inside the route's span on this chromosome that no segment
   * covers — the piece a deletion drops.
   */
  copies: number
}

export interface SegmentLettering {
  /**
   * Chromosomes in the order the path first visits them, pieces in genomic
   * order within each, lettered A, B, … in that sequence.
   */
  pieces: ReferencePiece[]
  /**
   * Per path segment, the letters it traverses in traversal order: an inverted
   * segment lists its pieces from the high coordinate down, each primed.
   */
  segmentLetters: string[][]
  /** The derivative as one string: `A B C D E′ B′`. */
  derivative: string
}

export const INVERTED_PRIME = '′'

/** A, B, … Z, AA, AB, … — a path of 943 segments still gets distinct letters. */
export function pieceLetter(index: number) {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

export function letterSegments(
  segments: DerivativeSegment[],
): SegmentLettering {
  const pieces: ReferencePiece[] = []
  for (const refName of new Set(segments.map(seg => seg.refName))) {
    const own = segments.filter(seg => seg.refName === refName)
    const cuts = [...new Set(own.flatMap(seg => [seg.start, seg.end]))].sort(
      (a, b) => a - b,
    )
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i]!
      const end = cuts[i + 1]!
      pieces.push({
        letter: pieceLetter(pieces.length),
        refName,
        start,
        end,
        copies: own.filter(seg => seg.start <= start && seg.end >= end).length,
      })
    }
  }
  const segmentLetters = segments.map(seg => {
    const covered = pieces.filter(
      piece =>
        piece.refName === seg.refName &&
        piece.start >= seg.start &&
        piece.end <= seg.end,
    )
    return seg.strand === -1
      ? covered.reverse().map(piece => piece.letter + INVERTED_PRIME)
      : covered.map(piece => piece.letter)
  })
  return {
    pieces,
    segmentLetters,
    derivative: segmentLetters.flat().join(' '),
  }
}

/**
 * The derivative string cut to a readable length for a one-line label. A route
 * of hundreds of segments is a fact about the window rather than an allele, and
 * the figure carries the whole string.
 */
export function derivativeLetterSummary(
  lettering: SegmentLettering,
  maxShown = 12,
) {
  const letters = lettering.segmentLetters.flat()
  if (letters.length <= maxShown) {
    return lettering.derivative
  }
  return `${letters.slice(0, maxShown).join(' ')} … ${
    letters.length - maxShown
  } more`
}
