import { CIGAR_D, CIGAR_I, CIGAR_INDEL_MASK, CIGAR_N } from '@jbrowse/cigar-utils'
import { visitCigarRenderedSegments } from '@jbrowse/synteny-core'

import { writeHiLo } from './hpMathSplit.ts'
import {
  KIND_BASE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
  KIND_MARKER,
} from './syntenyColors.ts'

// Worker-side geometry. `colors` is injected by the main thread (computedColors
// in the display model) and is the only field SyntenyInstanceData adds. Keeps
// the worker output independent of colorBy and lets colorBy changes re-upload
// without an RPC refetch.
//
// Corner positions are stored as cumulative-bp (NOT pixel) hi/lo Float32
// pairs. These reconstruct the screen position via hp-math in the vertex
// shader, which avoids the Float32 precision blow-up that pixel-space storage
// suffered when the mate was on a distant chromosome.
export interface SyntenyGeometry {
  bp1Hi: Float32Array
  bp1Lo: Float32Array
  bp2Hi: Float32Array
  bp2Lo: Float32Array
  bp3Hi: Float32Array
  bp3Lo: Float32Array
  bp4Hi: Float32Array
  bp4Lo: Float32Array
  // Per-instance descriptors driving main-thread color recomputation on
  // colorBy change. `kinds` is one of the `KIND_*` constants from
  // syntenyColors.ts; `instanceFeatureIdx` is the parent feature index in
  // SyntenyFeatureData (strands/refNames/...). Picking IDs are derived as
  // `instanceFeatureIdx[i] + 1` at interleave time (0 reserved for "no hit").
  kinds: Uint8Array
  instanceFeatureIdx: Uint32Array
  alignmentLengths: Float32Array
  instanceCount: number
}

export type SyntenyInstanceData = SyntenyGeometry & { colors: Uint32Array }

// Minimum on-screen alignment width (px) below which CIGAR detail is neither
// parsed nor drawn. Shared with the parse gate in
// executeSyntenyFeaturesAndPositions so a feature's CIGAR is parsed only when
// it will actually be visited here.
//
// Kept in step with MIN_INDEL_PX (the per-op merge gate): a block only needs to
// be wide enough to hold a visible indel to be worth parsing, and the per-op
// gate already drops sub-pixel indels within it. A larger block gate just
// redundantly hides detail on small-but-visible blocks — the "1px details are
// interesting" frission this view is meant to preserve.
export const MIN_CIGAR_PX_WIDTH = 2

// Off-screen px kept on each side so panning reveals ribbons without a refetch.
// executeSyntenyFeaturesAndPositions culls whole features first, so its cull
// buffer must be >= this or it would silently drop features this stage wants to
// emit geometry for (defeating the pan buffer on views narrower than 2*this).
export const PAN_BUFFER_PX = 2000

// Colored-indel instance kind for an I/D/N op; undefined for any match op.
function indelKind(op: number) {
  return op === CIGAR_I
    ? KIND_CIGAR_I
    : op === CIGAR_D
      ? KIND_CIGAR_D
      : op === CIGAR_N
        ? KIND_CIGAR_N
        : undefined
}

export function buildSyntenyGeometry({
  p11_cumBp,
  p12_cumBp,
  p21_cumBp,
  p22_cumBp,
  strands,
  parsedCigars,
  starts,
  ends,
  drawCIGAR,
  drawCIGARMatchesOnly,
  drawLocationMarkers,
  bpPerPx0,
  bpPerPx1,
  viewOff0,
  viewOff1,
  viewWidth,
}: {
  p11_cumBp: Float64Array
  p12_cumBp: Float64Array
  p21_cumBp: Float64Array
  p22_cumBp: Float64Array
  strands: Int8Array
  parsedCigars: ArrayLike<number>[]
  starts: Uint32Array
  ends: Uint32Array
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  drawLocationMarkers: boolean
  bpPerPx0: number
  bpPerPx1: number
  viewOff0: number
  viewOff1: number
  viewWidth: number
}): SyntenyGeometry {
  const featureCount = p11_cumBp.length

  const emitLeft = -PAN_BUFFER_PX
  const emitRight = viewWidth + PAN_BUFFER_PX
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  const alignmentLengths = new Float32Array(featureCount)
  // Per-feature: did we decide to draw CIGAR detail? Pass 1 always emits
  // KIND_BASE. When true, pass 2 runs the visitor and emits indel quads on top.
  const willDrawCigarArr = new Uint8Array(featureCount)

  // Single pre-pass: fill alignmentLengths, willDrawCigar, and accumulate the exact
  // upper-bound capacity. visitCigarRenderedSegments emits a segment only
  // when bp1 OR bp2 has advanced > 1 px from the segment start, so
  // per-feature visitor emissions are bounded by widthPx0 + widthPx1
  // regardless of CIGAR length. Markers from addLocationMarkers are
  // bounded by (widthPx0 + widthPx1) / 10 (markers spaced >= 20 px apart
  // along each axis, summed across both axes). These bounds are strict, so
  // a single allocation matches actual usage — no growable buffers.
  let capacity = 0
  for (let i = 0; i < featureCount; i++) {
    // Per-feature alignment length, used solely for the minAlignmentLength
    // cull (shader isCulled + pick engine). Each block is filtered by its own
    // span — what the "Min length" control means to users. This is enforced
    // structurally: geometry never receives feature names, so it cannot sum
    // spans across blocks that share one. That matters because names DO
    // legitimately repeat (e.g. a BAM read's QNAME is shared across its split/
    // supplementary alignments) — and summing those would keep a read whose
    // pieces are each tiny, or hide a substantial single block, neither of
    // which is what a per-length filter should do.
    alignmentLengths[i] = Math.abs(ends[i]! - starts[i]!)

    const cigar = parsedCigars[i]!
    const widthPx0 = Math.abs(p12_cumBp[i]! - p11_cumBp[i]!) * bpPerPxInv0
    const widthPx1 = Math.abs(p22_cumBp[i]! - p21_cumBp[i]!) * bpPerPxInv1
    let cigarBudget = 0
    if (
      cigar.length > 0 &&
      drawCIGAR &&
      Math.max(widthPx0, widthPx1) >= MIN_CIGAR_PX_WIDTH
    ) {
      willDrawCigarArr[i] = 1
      cigarBudget = Math.min(cigar.length, Math.ceil(widthPx0 + widthPx1) + 4)
    }
    const markerBudget = drawLocationMarkers
      ? Math.ceil((widthPx0 + widthPx1) / 10) + 4
      : 0
    capacity += 1 + cigarBudget + markerBudget
  }

  // Write cumBp hi/lo Float32 pairs directly at emit time. The shader
  // reconstructs screen pixel via `(cumBpHi + cumBpLo) / bpPerPx` using
  // hp-math, so the worker never needs to materialize Float64 pixel staging
  // arrays — converting and splitting happens inline in `addInstance`.
  const bp1HiArr = new Float32Array(capacity)
  const bp1LoArr = new Float32Array(capacity)
  const bp2HiArr = new Float32Array(capacity)
  const bp2LoArr = new Float32Array(capacity)
  const bp3HiArr = new Float32Array(capacity)
  const bp3LoArr = new Float32Array(capacity)
  const bp4HiArr = new Float32Array(capacity)
  const bp4LoArr = new Float32Array(capacity)
  const kindsArr = new Uint8Array(capacity)
  const featIdxArr = new Uint32Array(capacity)
  const instanceAlignmentLengths = new Float32Array(capacity)

  let idx = 0

  // All four corner values are cumBp (bpBefore + bpOffset).
  function addInstance(
    cumBp1: number,
    cumBp2: number,
    cumBp3: number,
    cumBp4: number,
    kind: number,
    featureIdx: number,
    alignmentLength: number,
  ) {
    writeHiLo(cumBp1, bp1HiArr, bp1LoArr, idx)
    writeHiLo(cumBp2, bp2HiArr, bp2LoArr, idx)
    writeHiLo(cumBp3, bp3HiArr, bp3LoArr, idx)
    writeHiLo(cumBp4, bp4HiArr, bp4LoArr, idx)
    kindsArr[idx] = kind
    featIdxArr[idx] = featureIdx
    instanceAlignmentLengths[idx] = alignmentLength
    idx++
  }

  // All four corner values are cumBp. Off-screen check converts to screen px.
  function addLocationMarkers(
    bp1Start: number,
    bp1End: number,
    bp2End: number,
    bp2Start: number,
    featureIdx: number,
    alignmentLength: number,
  ) {
    const width1 = Math.abs(bp1End - bp1Start) * bpPerPxInv0
    const width2 = Math.abs(bp2End - bp2Start) * bpPerPxInv1
    const averageWidth = (width1 + width2) / 2

    if (averageWidth < 30) {
      return
    }

    const targetPixelSpacing = 20
    const numMarkers = Math.max(
      2,
      Math.floor(averageWidth / targetPixelSpacing) + 1,
    )

    for (let step = 0; step < numMarkers; step++) {
      const t = step / (numMarkers - 1)
      const markerBp1 = bp1Start + (bp1End - bp1Start) * t
      const markerBp2 = bp2Start + (bp2End - bp2Start) * t

      const screenTopX = markerBp1 * bpPerPxInv0 - viewOff0
      const screenBottomX = markerBp2 * bpPerPxInv1 - viewOff1
      if (
        (screenTopX < emitLeft || screenTopX > emitRight) &&
        (screenBottomX < emitLeft || screenBottomX > emitRight)
      ) {
        continue
      }

      addInstance(
        markerBp1,
        markerBp1,
        markerBp2,
        markerBp2,
        KIND_MARKER,
        featureIdx,
        alignmentLength,
      )
    }
  }

  // A CIGAR feature is "tiled": pass 2 paints it one quad per match segment
  // rather than pass 1 laying down one full-span base. Only transparent-indels
  // mode tiles — see cigarSegmentKind.
  function isTiled(i: number) {
    return drawCIGARMatchesOnly && !!willDrawCigarArr[i]
  }

  // The instance kind a rendered CIGAR segment contributes, or undefined to
  // skip it. The two display modes are exact complements:
  //   colored indels             -> paint indels colored; matches ride the
  //                                  full-span base from pass 1
  //   transparent (matchesOnly)  -> paint matches as base color; indels left
  //                                  unpainted (see-through)
  // No seam results from tiling matches: KIND_BASE_HIDDEN was dropped because
  // *seamless* coverage needed every quad to tile perfectly (sub-pixel FP gaps
  // showed as stripes), whereas match segments only ever abut across a real
  // (>1px) indel — exactly where a gap is wanted.
  function cigarSegmentKind(op: number) {
    const isIndel = ((1 << op) & CIGAR_INDEL_MASK) !== 0
    // transparent: base color on matches only (indels stay see-through).
    // colored: indelKind per indel (undefined on matches -> pass-1 base covers).
    const transparentKind = isIndel ? undefined : KIND_BASE
    return drawCIGARMatchesOnly ? transparentKind : indelKind(op)
  }

  // A rendered segment is off-screen when both axes fall outside the pan
  // buffer. cumBp -> screen px, then compared to the emit window.
  function segmentOffScreen(
    bp1Start: number,
    bp1End: number,
    bp2Start: number,
    bp2End: number,
  ) {
    const topMin = Math.min(bp1Start, bp1End) * bpPerPxInv0 - viewOff0
    const topMax = Math.max(bp1Start, bp1End) * bpPerPxInv0 - viewOff0
    const botMin = Math.min(bp2Start, bp2End) * bpPerPxInv1 - viewOff1
    const botMax = Math.max(bp2Start, bp2End) * bpPerPxInv1 - viewOff1
    return (
      (topMax < emitLeft || topMin > emitRight) &&
      (botMax < emitLeft || botMin > emitRight)
    )
  }

  // Pass 1: one full-span KIND_BASE trapezoid per feature for gapless
  // match-color coverage. Tiled features skip it — pass 2 lays their base down
  // per match segment so the intervening indels stay see-through.
  function emitNonCigarFeature(i: number) {
    const x11 = p11_cumBp[i]!
    const x12 = p12_cumBp[i]!
    const x21 = p21_cumBp[i]!
    const x22 = p22_cumBp[i]!
    if (!isTiled(i)) {
      addInstance(x11, x12, x22, x21, KIND_BASE, i, alignmentLengths[i]!)
    }
    if (!willDrawCigarArr[i] && drawLocationMarkers) {
      addLocationMarkers(x11, x12, x22, x21, i, alignmentLengths[i]!)
    }
  }

  for (let i = 0; i < featureCount; i++) {
    emitNonCigarFeature(i)
  }

  // Pass 2: per-segment CIGAR quads on top of pass 1. cigarSegmentKind decides
  // which segments draw and as what (colored indels vs. base-tiled matches).
  for (let i = 0; i < featureCount; i++) {
    if (!willDrawCigarArr[i]) {
      continue
    }
    const cigar = parsedCigars[i]!
    const x11 = p11_cumBp[i]!
    const x12 = p12_cumBp[i]!
    const x21 = p21_cumBp[i]!
    const x22 = p22_cumBp[i]!
    const strand = strands[i]!
    const alignmentLength = alignmentLengths[i]!

    const k1 = strand === -1 ? x12 : x11
    const k2 = strand === -1 ? x11 : x12
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (x21 < x22 ? 1 : -1) * strand

    visitCigarRenderedSegments(
      cigar,
      k1,
      strand === -1 ? x22 : x21,
      bpPerPx0,
      bpPerPx1,
      rev1,
      rev2,
      (resolvedOp, segBp1Start, segBp1End, segBp2Start, segBp2End) => {
        if (!segmentOffScreen(segBp1Start, segBp1End, segBp2Start, segBp2End)) {
          const kind = cigarSegmentKind(resolvedOp)
          if (kind !== undefined) {
            addInstance(
              segBp1Start,
              segBp1End,
              segBp2End,
              segBp2Start,
              kind,
              i,
              alignmentLength,
            )
          }
          if (drawLocationMarkers) {
            addLocationMarkers(
              segBp1Start,
              segBp1End,
              segBp2End,
              segBp2Start,
              i,
              alignmentLength,
            )
          }
        }
      },
    )
  }

  const instanceCount = idx

  return {
    bp1Hi: bp1HiArr.subarray(0, instanceCount),
    bp1Lo: bp1LoArr.subarray(0, instanceCount),
    bp2Hi: bp2HiArr.subarray(0, instanceCount),
    bp2Lo: bp2LoArr.subarray(0, instanceCount),
    bp3Hi: bp3HiArr.subarray(0, instanceCount),
    bp3Lo: bp3LoArr.subarray(0, instanceCount),
    bp4Hi: bp4HiArr.subarray(0, instanceCount),
    bp4Lo: bp4LoArr.subarray(0, instanceCount),
    kinds: kindsArr.subarray(0, instanceCount),
    instanceFeatureIdx: featIdxArr.subarray(0, instanceCount),
    alignmentLengths: instanceAlignmentLengths.subarray(0, instanceCount),
    instanceCount,
  }
}
