import { reverseComplementChain } from './computePaths.ts'

import type { NamedReadChain, SegAln } from '../arcs/compute.ts'
import type { DerivativeSegment } from './computePaths.ts'

// Reads on the reconstructed allele, by coordinate transformation rather than by
// realignment.
//
// A derivative path is a piecewise-linear map from reference coordinates onto
// the allele's own axis: segment i occupies [offset_i, offset_i + length_i),
// forward or reversed. A read's alignment is already a map from the read to the
// reference. Composing the two puts the read on the allele — no consensus
// contig, no aligner, no sequence involved at all, which is what makes this
// runnable in the browser on reads that are already fetched.
//
// What the picture then says is contiguity: a read whose chain follows the path
// lands as one unbroken run of derivative coordinates, and a read that leaves it
// breaks. That is the check the reconstruction otherwise has no way to show —
// the ribbons are drawn FROM the reads, so they cannot disagree with them, while
// a read placed on the allele can.

export interface ProjectedReadPiece {
  // derivative coordinates
  start: number
  end: number
  // Orientation in the derivative frame: +1 when the read runs the same way the
  // allele is drawn. The read's own strand composed with the path segment's, so
  // a reverse read on an inverted segment is +1 — that pair IS what a foldback
  // looks like from a read that crosses it.
  strand: number
  // the reference interval this came from, clipped to the segment
  refName: string
  refStart: number
  refEnd: number
  // which path segment it was placed on
  segmentIndex: number
  // false for a piece known only from an SA tag, i.e. one no displayed region
  // currently covers
  onScreen: boolean
}

export interface ProjectedRead {
  readName: string
  // in read order, so a discontinuity between consecutive entries is a
  // discontinuity along the molecule
  pieces: ProjectedReadPiece[]
  // outer bounds in derivative coordinates
  start: number
  end: number
  // Segments of the read's chain that no path segment accounts for — the read
  // goes somewhere the allele does not.
  unplacedCount: number
  // Largest discontinuity between read-consecutive pieces, in bp, 0 for a
  // single-piece read. Reported rather than only thresholded: how far off a read
  // is is the evidence, and the caller may want to say so.
  maxGap: number
  // +1 when the read traverses the allele in the direction it is drawn, -1 when
  // it crosses the same molecule the other way. Both readings occur in one
  // fetch; a derivative and its reverse complement are one molecule.
  strand: number
  // Every chain segment placed, in order, in one orientation, with no gap over
  // the tolerance. This read is evidence FOR the allele; a false one is the
  // interesting contrast rather than an error.
  followsPath: boolean
}

export interface ProjectReadsOpts {
  segments: DerivativeSegment[]
  chains: NamedReadChain[]
  /**
   * How far two junction coordinates may differ before the read is called
   * broken. The path's junctions come from ONE representative read, and two
   * reads crossing one breakpoint agree only to within the aligner's placement
   * of it plus whatever microhomology or inserted sequence sits at the join, so
   * a read that supports the allele still lands tens of bp off.
   */
  tolerance?: number
}

const DEFAULT_TOLERANCE = 100

/**
 * #api
 * Where each path segment starts on the derivative axis, as a prefix sum with
 * the total length in the final entry — so `offsets[i]` is segment i's origin
 * and `offsets[segments.length]` is the allele's length.
 *
 * The one spelling of the offset walk. `buildDerivativeVsRefSpec` lays the
 * ribbons out with it and this file places reads with it, and a second spelling
 * of it would put the reads somewhere other than the ribbons they belong to
 * without either side looking wrong on its own.
 */
export function derivativeOffsets(segments: DerivativeSegment[]) {
  const offsets = [0]
  let offset = 0
  for (const seg of segments) {
    offset += seg.end - seg.start
    offsets.push(offset)
  }
  return offsets
}

// One read segment against one path segment. Returns undefined when they do not
// overlap on the reference at all, which is most pairs.
function clipToSegment(
  seg: DerivativeSegment,
  offset: number,
  aln: SegAln,
  segmentIndex: number,
): ProjectedReadPiece | undefined {
  if (aln.refName !== seg.refName) {
    return undefined
  }
  const refStart = Math.max(aln.start, seg.start)
  const refEnd = Math.min(aln.end, seg.end)
  if (refEnd <= refStart) {
    return undefined
  }
  const forward = seg.strand !== -1
  return {
    // A reversed segment runs the other way, so the read's high reference
    // coordinate is its LOW derivative one.
    start: forward ? offset + refStart - seg.start : offset + seg.end - refEnd,
    end: forward ? offset + refEnd - seg.start : offset + seg.end - refStart,
    strand: forward ? aln.strand : -aln.strand,
    refName: aln.refName,
    refStart,
    refEnd,
    segmentIndex,
    onScreen: aln.onScreen,
  }
}

interface Placement {
  pieces: ProjectedReadPiece[]
  unplaced: number
}

// Walk the read's chain along the path, in step. The cursor only moves forward,
// which is what makes this a placement of the read ON the path rather than a
// per-segment lookup: a foldback puts one reference interval on the path twice,
// and nothing about a single chr3 arm in isolation says which copy it is.
//
// The cursor is not advanced PAST the segment it lands on, so two read-adjacent
// segments may share one path segment — that is a small indel or an inversion
// inside a segment, which the gap check then reports rather than this dropping.
function placeChain(
  chain: SegAln[],
  segments: DerivativeSegment[],
  offsets: number[],
): Placement {
  const pieces: ProjectedReadPiece[] = []
  let unplaced = 0
  let cursor = 0
  for (const aln of chain) {
    let best: ProjectedReadPiece | undefined
    for (let i = cursor; i < segments.length; i++) {
      const piece = clipToSegment(segments[i]!, offsets[i]!, aln, i)
      if (piece) {
        best ??= piece
        // Orientation is the other half of the foldback answer: of two copies of
        // one interval, the arm belongs to the one it runs the same way as. Take
        // the first overlap that agrees, and the first overlap at all otherwise.
        if (piece.strand === 1) {
          best = piece
          break
        }
      }
    }
    if (best) {
      pieces.push(best)
      cursor = best.segmentIndex
    } else {
      unplaced++
    }
  }
  return { pieces, unplaced }
}

function gapBetween(a: ProjectedReadPiece, b: ProjectedReadPiece) {
  return b.start - a.end
}

// How well a placement fits, as a count of pieces rather than a span of bases.
// Deliberately: the outer segments of a path are the long ones (an ONT read's
// first arm can be 30 kb against a 200 bp templated insert), so a bases-weighted
// score is decided entirely by where the long arm landed and reads a
// 1-of-4-pieces fit as better than a 4-of-4 one. Which happens on COLO829's own
// der(3), where the wrong reading of every supporting read scores higher by bp.
function runLength(pieces: ProjectedReadPiece[], tolerance: number) {
  let best = 0
  let run = 0
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!
    const prev = pieces[i - 1]
    const joins =
      piece.strand === 1 &&
      (prev === undefined ||
        (prev.strand === 1 && Math.abs(gapBetween(prev, piece)) <= tolerance))
    run = joins ? run + 1 : piece.strand === 1 ? 1 : 0
    best = Math.max(best, run)
  }
  return best
}

function mappedBp(pieces: ProjectedReadPiece[]) {
  return pieces.reduce((sum, piece) => sum + piece.end - piece.start, 0)
}

/**
 * #api
 * Place each read's chain on a derivative path, in the path's own coordinates.
 *
 * Reads that touch the path nowhere are dropped; every other read is returned
 * whether or not it fits, because the ones that do not are the contrast that
 * makes the ones that do mean something.
 */
export function projectReadsOntoDerivative(
  opts: ProjectReadsOpts,
): ProjectedRead[] {
  const { segments, chains } = opts
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE
  const offsets = derivativeOffsets(segments)

  const projected: ProjectedRead[] = []
  for (const { readName, chain } of chains) {
    // Both readings of the molecule, then the better fit. A read crossing this
    // allele has no reason to have been sequenced in the direction the path
    // happens to be drawn in, and the reverse reading of a supporting read fits
    // nothing: its segments arrive in the opposite order to the path, so the
    // forward-only cursor leaves most of them unplaced.
    const forward = placeChain(chain, segments, offsets)
    const reverse = placeChain(reverseComplementChain(chain), segments, offsets)
    const forwardRun = runLength(forward.pieces, tolerance)
    const reverseRun = runLength(reverse.pieces, tolerance)
    const useForward =
      forwardRun !== reverseRun
        ? forwardRun > reverseRun
        : mappedBp(forward.pieces) >= mappedBp(reverse.pieces)
    const { pieces, unplaced } = useForward ? forward : reverse
    if (pieces.length === 0) {
      continue
    }
    let maxGap = 0
    for (let i = 1; i < pieces.length; i++) {
      maxGap = Math.max(
        maxGap,
        Math.abs(gapBetween(pieces[i - 1]!, pieces[i]!)),
      )
    }
    projected.push({
      readName,
      pieces,
      start: Math.min(...pieces.map(piece => piece.start)),
      end: Math.max(...pieces.map(piece => piece.end)),
      unplacedCount: unplaced,
      maxGap,
      strand: useForward ? 1 : -1,
      followsPath:
        unplaced === 0 &&
        maxGap <= tolerance &&
        pieces.every(piece => piece.strand === 1),
    })
  }
  return projected
}
