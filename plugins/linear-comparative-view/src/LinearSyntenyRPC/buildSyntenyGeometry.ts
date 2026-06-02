import { CIGAR_D, CIGAR_I, CIGAR_N } from '@jbrowse/cigar-utils'
import { visitCigarRenderedSegments } from '@jbrowse/synteny-core'

import { writeHiLo } from './hpMathSplit.ts'
import {
  KIND_BASE,
  KIND_BASE_HIDDEN,
  KIND_CIGAR_D,
  KIND_CIGAR_HIDDEN,
  KIND_CIGAR_I,
  KIND_CIGAR_MATCH,
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

  const panBufferPx = 2000
  const emitLeft = -panBufferPx
  const emitRight = viewWidth + panBufferPx
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1
  const minCigarPxWidth = 4

  const alignmentLengths = new Float32Array(featureCount)
  // Per-feature: did we decide to draw CIGAR detail? When true, pass 1 emits
  // KIND_BASE_HIDDEN (alpha-zero fill, but edge pass still draws the outline)
  // and pass 2 runs the visitor. When false, pass 1 emits KIND_BASE and pass
  // 2 skips the feature.
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
      Math.max(widthPx0, widthPx1) >= minCigarPxWidth
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

  // Emit whole-polygon instances. Features with CIGAR detail use
  // KIND_BASE_HIDDEN (alpha-zero fill, but edge/outline pass still draws them).
  function emitNonCigarFeature(i: number) {
    const x11 = p11_cumBp[i]!
    const x12 = p12_cumBp[i]!
    const x21 = p21_cumBp[i]!
    const x22 = p22_cumBp[i]!
    const willDrawCigar = willDrawCigarArr[i]!
    addInstance(
      x11,
      x12,
      x22,
      x21,
      willDrawCigar ? KIND_BASE_HIDDEN : KIND_BASE,
      i,
      alignmentLengths[i]!,
    )
    if (!willDrawCigar && drawLocationMarkers) {
      addLocationMarkers(x11, x12, x22, x21, i, alignmentLengths[i]!)
    }
  }

  for (let i = 0; i < featureCount; i++) {
    emitNonCigarFeature(i)
  }

  // Second loop: CIGAR instances (using cached parsed CIGARs). The visitor
  // merges sub-pixel ops, so features with no >= 1 px indels collapse to a
  // single KIND_CIGAR_MATCH quad — no separate fast path needed.
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
        const topMin =
          Math.min(segBp1Start, segBp1End) * bpPerPxInv0 - viewOff0
        const topMax =
          Math.max(segBp1Start, segBp1End) * bpPerPxInv0 - viewOff0
        const botMin =
          Math.min(segBp2Start, segBp2End) * bpPerPxInv1 - viewOff1
        const botMax =
          Math.max(segBp2Start, segBp2End) * bpPerPxInv1 - viewOff1
        const offScreen =
          (topMax < emitLeft || topMin > emitRight) &&
          (botMax < emitLeft || botMin > emitRight)

        if (!offScreen) {
          const isIndel =
            resolvedOp === CIGAR_I ||
            resolvedOp === CIGAR_D ||
            resolvedOp === CIGAR_N
          let kind: number
          if (drawCIGARMatchesOnly && isIndel) {
            kind = KIND_CIGAR_HIDDEN
          } else if (resolvedOp === CIGAR_I) {
            kind = KIND_CIGAR_I
          } else if (resolvedOp === CIGAR_D) {
            kind = KIND_CIGAR_D
          } else if (resolvedOp === CIGAR_N) {
            kind = KIND_CIGAR_N
          } else {
            kind = KIND_CIGAR_MATCH
          }
          addInstance(
            segBp1Start,
            segBp1End,
            segBp2End,
            segBp2Start,
            kind,
            i,
            alignmentLength,
          )

          if (drawLocationMarkers && !(drawCIGARMatchesOnly && isIndel)) {
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
