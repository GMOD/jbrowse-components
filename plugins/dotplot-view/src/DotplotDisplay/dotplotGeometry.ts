import {
  CIGAR_M,
  cigarWalkBp1,
  cigarWalkBp2,
  cigarWalkRev1,
  cigarWalkRev2,
  visitCigarRenderedSegments,
} from '@jbrowse/cigar-utils'

import { MIN_CIGAR_PX_WIDTH } from './dotplotCigarDetail.ts'

import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'

type GeometryBuffers = Omit<
  DotplotInstanceData,
  'instanceCount' | 'baseH' | 'baseV'
>

function allocBuffers(capacity: number): GeometryBuffers {
  return {
    x1: new Float64Array(capacity),
    y1: new Float64Array(capacity),
    x2: new Float64Array(capacity),
    y2: new Float64Array(capacity),
    instanceFeatureIdx: new Uint32Array(capacity),
    // Zero is CIGAR_M, which is what a segment carrying no CIGAR detail is: the
    // whole-feature line the else-branch below writes. Only indel ops are ever
    // reported (see `segmentCigarOp`), so the default needs no sentinel and the
    // non-CIGAR path needs no write.
    segmentOps: new Uint8Array(capacity),
  }
}

function writeSegment(
  b: GeometryBuffers,
  n: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  featureIdx: number,
  op = CIGAR_M,
) {
  b.x1[n] = x1
  b.y1[n] = y1
  b.x2[n] = x2
  b.y2[n] = y2
  b.instanceFeatureIdx[n] = featureIdx
  b.segmentOps[n] = op
}

// `subarray` is a view, so it pins the WHOLE allocation for as long as the
// display holds this geometry — and the allocation is a worst case (a segment
// per feature plus one per shipped CIGAR op) that the emitted count routinely
// falls far short of: at whole-genome zoom nearly every feature arrives with a
// CIGAR (the worker ships within 8x zoom headroom) and then collapses to a
// single segment because it is under MIN_CIGAR_PX_WIDTH, so the slack can be
// orders of magnitude larger than the data. Copy out once the slack exceeds the
// data, which both bounds retention at 2x and only spends a memcpy that recovers
// at least as much memory as it moves. Below that the view is kept: allocating a
// second copy of nearly-full buffers would cost more than it frees.
function trimToCount(
  b: GeometryBuffers,
  n: number,
  baseH: number,
  baseV: number,
): DotplotInstanceData {
  // `slice` copies, `subarray` views; identical signatures, so the choice is a
  // method name rather than a wrapper that would need a cast to stay generic
  const trim = n * 2 < b.instanceFeatureIdx.length ? 'slice' : 'subarray'
  return {
    x1: b.x1[trim](0, n),
    y1: b.y1[trim](0, n),
    x2: b.x2[trim](0, n),
    y2: b.y2[trim](0, n),
    instanceFeatureIdx: b.instanceFeatureIdx[trim](0, n),
    segmentOps: b.segmentOps[trim](0, n),
    instanceCount: n,
    baseH,
    baseV,
  }
}

// Upper bound on the segments `buildLineSegments` can emit: one per feature,
// plus what its CIGAR can contribute.
//
// TAKEN AGAINST THE PIXELS AS WELL AS THE OPS, which is the whole of this
// function. `visitCigarRenderedSegments` emits at most one segment per packed
// op, but it also emits only once either axis has advanced past a pixel, so a
// feature's emissions are bounded by its two on-screen widths no matter how many
// ops it carries — the same pair of bounds `buildSyntenyGeometry`'s
// `cigarBudget` takes the min of. Counting ops alone reserved a slot per op: one
// 40Mb block with a 1M-op CIGAR across a 1400px axis asked for 1,000,001 slots
// (37MB over the six lanes) to emit 1,399 segments, and a liftOver chain block
// is exactly that shape.
//
// Summed per feature rather than as one min over the totals, because that is the
// tighter of the two and costs a loop over `count` reading lanes already in
// memory.
//
// WHAT THIS TRADES, since it is a whole pass added to every build to bound a
// case most builds do not hit. The pass is O(count) over four Float64 lanes and
// no allocation, against an emit loop that is O(count + segments) and walks
// CIGARs — so it does not register on an ordinary view. What it buys is not the
// 37MB above but the shape of it: the reservation is ~9x the size of the parsed
// CIGAR, so a chain track whose ops reach 100MB asks for most of a gigabyte, in
// a worker, and nothing else in the build is sized off the data that way.
//
// It also makes the bound TIGHT where a loose one was previously safe by
// construction, which is why the emit gained a guard at the same time. If this
// is ever suspected of dropping segments, check that guard's counter before
// re-deriving the arithmetic: a bound that is wrong here is silent, and the
// guard is the only thing standing between it and NaN corners.
//
// `+ 4` is slack for the visitor's final flush and for the segments' floating
// point not summing to exactly the corner span. It matters because the emit
// drops silently past capacity, and it is why this is exported: a test that
// recomputed the bound could not notice this one moving.
export function segmentCapacity(
  data: Pick<DotplotRpcData, 'p11' | 'p12' | 'p21' | 'p22' | 'cigarOffsets'>,
  drawCigar: boolean,
  bpPerPxHInv: number,
  bpPerPxVInv: number,
) {
  const { p11, p12, p21, p22, cigarOffsets } = data
  const count = p11.length
  let capacity = count
  if (drawCigar) {
    for (let i = 0; i < count; i++) {
      const ops = cigarOffsets[i + 1]! - cigarOffsets[i]!
      const wH = Math.abs(p12[i]! - p11[i]!) * bpPerPxHInv
      const wV = Math.abs(p22[i]! - p21[i]!) * bpPerPxVInv
      capacity += Math.min(ops, Math.ceil(wH + wV) + 4)
    }
  }
  return capacity
}

export function buildLineSegments(
  data: DotplotRpcData,
  drawCigar: boolean,
  minAlignmentLength: number,
  bpPerPxH: number,
  bpPerPxV: number,
  baseH: number,
  baseV: number,
): DotplotInstanceData {
  const {
    p11,
    p12,
    p21,
    p22,
    strands,
    alignmentLengths,
    cigarData,
    cigarOffsets,
  } = data
  const count = p11.length
  const bpPerPxHInv = 1 / bpPerPxH
  const bpPerPxVInv = 1 / bpPerPxV

  const maxSegments = segmentCapacity(data, drawCigar, bpPerPxHInv, bpPerPxVInv)

  const buf = allocBuffers(maxSegments)
  let n = 0

  for (let i = 0; i < count; i++) {
    if (minAlignmentLength > 0 && alignmentLengths[i]! < minAlignmentLength) {
      continue
    }
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const cigarStart = cigarOffsets[i]!
    const cigarEnd = cigarOffsets[i + 1]!
    const featureWidthPx = Math.max(
      Math.abs(x2 - x1) * bpPerPxHInv,
      Math.abs(y2 - y1) * bpPerPxVInv,
    )
    if (
      cigarEnd > cigarStart &&
      drawCigar &&
      featureWidthPx >= MIN_CIGAR_PX_WIDTH
    ) {
      // The walk's start corner and per-axis direction, shared with
      // `buildSyntenyGeometry` off the same p11..p22 lanes — a reverse-strand
      // CIGAR does not begin at the (x1,y1) corner, and the two views
      // disagreeing about that is what these exist to prevent. Inside the gate,
      // not above it: at whole-genome zoom nearly every feature takes the flat
      // branch below and has no CIGAR to start.
      const strand = strands[i]!
      visitCigarRenderedSegments(
        // a view, not a copy — visitCigarRenderedSegments takes ArrayLike
        cigarData.subarray(cigarStart, cigarEnd),
        cigarWalkBp1(x1, x2, strand),
        cigarWalkBp2(y1, y2, strand),
        bpPerPxH,
        bpPerPxV,
        cigarWalkRev1(x1, x2, strand),
        cigarWalkRev2(y1, y2, strand),
        (op, seg1Start, seg1End, seg2Start, seg2End) => {
          // The bound above is strict, so this never trips. It is here because
          // the failure mode otherwise is silent and far away: a typed-array
          // write past the end is a no-op while `n` keeps counting, so
          // `trimToCount` would hand the renderer a short array and every read
          // past the end would project as NaN.
          if (n < maxSegments) {
            writeSegment(buf, n, seg1Start, seg2Start, seg1End, seg2End, i, op)
            n++
          }
        },
      )
    } else {
      writeSegment(buf, n, x1, y1, x2, y2, i)
      n++
    }
  }

  return trimToCount(buf, n, baseH, baseV)
}
