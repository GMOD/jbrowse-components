import { parseCigar2Typed } from '@jbrowse/alignments-core'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import type { BpRegionIndex } from '@jbrowse/synteny-core'

// Per-perspective PIF/PAF CIGAR consumption, matching buildSyntenyGeometry's
// walk: bp1 (query / v1 side) advances on M/=/X and D/N; bp2 (target / v2 side)
// advances on M/=/X and I. The D<->I asymmetry is the pre-swap the PIF t-line
// carries, so a clip produced here stays consistent when it feeds back through
// the same convention.
function consumesQuery(op: number) {
  return op !== 1 // everything except I(=1)
}
function consumesTarget(op: number) {
  return op !== CIGAR_D && op !== CIGAR_N
}
function isMatchOp(op: number) {
  return op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X
}

export interface ClippedSyntenyFeature {
  start: number
  end: number
  mateStart: number
  mateEnd: number
  cigar: Uint32Array
}

// Trim a synteny feature + its CIGAR to a query-space window
// [winStart, winEnd], returning the re-anchored coords + trimmed CIGAR, or
// undefined if the block doesn't overlap the window.
//
// A single alignment block can span far beyond the viewport — a whole UCSC
// liftOver chain is one ~20 Mb feature. Its base ribbon is drawn as one *linear*
// trapezoid across that span, which cannot follow megabases of indels, so at
// high zoom the ribbon lands off-screen and nothing renders. Re-anchoring the
// block to just its visible slice (accurate coords + a short CIGAR) restores it.
//
// Walk direction MUST match buildSyntenyGeometry, which walks the query (v1)
// axis forward in GENOMIC order for BOTH strands and flips only the target (v2)
// axis. So the query walk here is always start->end; only the target counts
// down for a - strand block, entering at mateEnd. Within a match op the target
// maps to the query as target(q) = bp2 + (q - bp1) * revTarget, using the op's
// walk-entry positions. (buildSyntenyGeometry re-derives its rev1 from the cumBp
// order of the endpoints, so a reversed display region walks the same file-order
// CIGAR the other way in cumBp space — still forward in genomic query bp, so
// this reassembly stays valid.)
//
// Walking the query backward for - strand (as an earlier version did) mirrors
// every indel's query position within the window: the trimmed CIGAR is
// reassembled in file order and re-walked forward by buildSyntenyGeometry, so a
// deletion lands at its mirror-image position (wrong side of the ribbon).
export function clipSyntenyFeature(
  cigar: Uint32Array,
  start: number,
  mateStart: number,
  mateEnd: number,
  strand: number,
  winStart: number,
  winEnd: number,
): ClippedSyntenyFeature | undefined {
  const revTarget = strand === -1 ? -1 : 1
  let bp1 = start
  let bp2 = strand === -1 ? mateEnd : mateStart
  const out: number[] = []
  let qLo = Infinity
  let qHi = -Infinity
  let tLo = Infinity
  let tHi = -Infinity
  const extendTarget = (a: number, b: number) => {
    tLo = Math.min(tLo, a, b)
    tHi = Math.max(tHi, a, b)
  }
  for (let k = 0; k < cigar.length; k++) {
    const packed = cigar[k]!
    const len = packed >>> 4
    const op = packed & 0xf
    const qAdv = consumesQuery(op) ? len : 0
    const tAdv = consumesTarget(op) ? len : 0
    const bp1Next = bp1 + qAdv
    const bp2Next = bp2 + tAdv * revTarget
    const opQLo = bp1
    const opQHi = bp1Next
    if (opQHi >= winStart && opQLo <= winEnd) {
      if (qAdv > 0) {
        // Query-consuming op (match or D/N): trim to the window in query space.
        const cLo = Math.max(opQLo, winStart)
        const cHi = Math.min(opQHi, winEnd)
        if (cHi > cLo) {
          out.push(((cHi - cLo) << 4) | op)
          qLo = Math.min(qLo, cLo)
          qHi = Math.max(qHi, cHi)
          if (isMatchOp(op)) {
            // matches map target 1:1: target(q) = bp2 + (q - bp1) * revTarget
            extendTarget(
              bp2 + (cLo - bp1) * revTarget,
              bp2 + (cHi - bp1) * revTarget,
            )
          } else {
            // D/N consume no target, so it stays a point at bp2
            extendTarget(bp2, bp2)
          }
        }
      } else if (bp1 >= winStart && bp1 <= winEnd) {
        // I: target-consuming gap at a single query position; keep it whole
        out.push(packed)
        qLo = Math.min(qLo, bp1)
        qHi = Math.max(qHi, bp1)
        extendTarget(bp2, bp2Next)
      }
    }
    bp1 = bp1Next
    bp2 = bp2Next
    // query ascends monotonically, so once past the window we can stop (only
    // after collecting at least one op)
    if (out.length && bp1 > winEnd) {
      break
    }
  }
  if (out.length === 0) {
    return undefined
  }
  return {
    start: qLo,
    end: qHi,
    mateStart: tLo,
    mateEnd: tHi,
    cigar: Uint32Array.from(out),
  }
}

// Worker glue over clipSyntenyFeature: gate on size + resolve the v1 region the
// visible window is over, convert the window to that region's local bp, parse
// the CIGAR and clip. Returns undefined (leave the block untouched) unless it is
// a CIGAR block more than `spanRatio`x the window on a clippable region. The clip
// itself is region-orientation-agnostic (it walks genomic query bp forward), and
// buildSyntenyGeometry re-derives its rev1 from the cumBp order of the clipped
// endpoints — so a reversed v1 region only changes the cumBp->local-bp window
// mapping below, not the clip or the downstream projection.
export function clipLargeBlockToWindow({
  v1Index,
  refName,
  start,
  end,
  mateStart,
  mateEnd,
  strand,
  cigar,
  winCumLo,
  winCumHi,
  windowSpan,
  spanRatio,
}: {
  v1Index: BpRegionIndex
  refName: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  strand: number
  cigar: string | undefined
  winCumLo: number
  winCumHi: number
  windowSpan: number
  spanRatio: number
}): ClippedSyntenyFeature | undefined {
  if (!cigar || end - start <= spanRatio * windowSpan) {
    return undefined
  }
  // Re-anchor to the region this refName's visible window falls in. A refName
  // can be displayed at several loci at once — e.g. a dispersed gene duplication
  // shows the same contig in multiple regions — so pick the region whose cumBp
  // span overlaps the window most (for the common single-region case, just that
  // region; no overlap = the block is off-screen, leave it untouched). Assumes
  // the same-refName regions are genomically DISJOINT (which the duplication
  // case is): the downstream projection resolves the clipped coords with
  // bpToCumBp, which picks the first region CONTAINING them — the same region we
  // clipped to only when the genomic ranges don't overlap. Overlapping copies of
  // one locus would need a region index threaded through the projection.
  const entries = v1Index.entries.get(refName) ?? []
  let r0: (typeof entries)[number] | undefined
  let bestOverlap = 0
  for (const e of entries) {
    const regLo = e.bpBefore
    const regHi = e.bpBefore + (e.region.end - e.region.start)
    const overlap = Math.min(winCumHi, regHi) - Math.max(winCumLo, regLo)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      r0 = e
    }
  }
  if (!r0) {
    return undefined
  }
  // Snap the window to integer bp (widen outward). winCumLo/Hi are
  // pixel-derived (offsetPx * bpPerPx), so they carry a sub-bp fraction. The
  // window is only a coarse "which ops to include" bound, but the clip trims
  // the boundary match op to start exactly at winStart — a fractional winStart
  // makes the whole re-anchored block's coords fractional (the op lengths stay
  // integer), rigidly shifting every tile/indel off the true integer-bp grid by
  // that fraction. At several px/bp that reads as indels landing mid-basepair,
  // misaligned vs the exact-bp LGVSyntenyDisplay. Flooring/ceiling keeps the
  // clipped block on the alignment's integer grid; the <1bp widening is well
  // inside the pan buffer.
  //
  // Invert bpToCumBp for this region's orientation. Forward: local =
  // cumBp - bpBefore + start (monotonic up). Reversed: local =
  // end - (cumBp - bpBefore) (monotonic down), so the low/high cumBp bounds map
  // to the high/low local bp — winStart takes winCumHi and winEnd winCumLo.
  const { region, bpBefore } = r0
  const winStart = region.reversed
    ? Math.floor(region.end - (winCumHi - bpBefore))
    : Math.floor(winCumLo - bpBefore + region.start)
  const winEnd = region.reversed
    ? Math.ceil(region.end - (winCumLo - bpBefore))
    : Math.ceil(winCumHi - bpBefore + region.start)
  return clipSyntenyFeature(
    parseCigar2Typed(cigar),
    start,
    mateStart,
    mateEnd,
    strand,
    winStart,
    winEnd,
  )
}
