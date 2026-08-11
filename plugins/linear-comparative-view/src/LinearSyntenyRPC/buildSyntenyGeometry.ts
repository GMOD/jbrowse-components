import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_INDEL_MASK,
  CIGAR_N,
} from '@jbrowse/cigar-utils'
import {
  syntenyPanBufferPx,
  visitCigarRenderedSegments,
} from '@jbrowse/synteny-core'

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
// Corner positions are stored as WINDOW-RELATIVE bp (NOT pixel): cumBp minus a
// per-axis fetch-time base (`base0`/`base1` = viewOff*bpPerPx at fetch). The
// base keeps on-screen corners small-magnitude, so a single Float32 per corner
// is sub-pixel accurate and the shader reconstructs screen X as
// `bp*bpPerPxInv + panPx` — no hi/lo hp-math split. Absolute cumBp is
// genome-scale (would need the split); the base cancels that. bp1/bp2 are the
// top view (base0), bp3/bp4 the bottom view (base1).
export interface SyntenyGeometry {
  bp1: Float32Array
  bp2: Float32Array
  bp3: Float32Array
  bp4: Float32Array
  // Per-axis fetch-time base cumBp (viewOff*bpPerPx). The main thread turns
  // these into the `panPx` uniforms each frame; the CPU Canvas2D/pick paths add
  // them back to recover absolute cumBp. Zoom-independent (bp units).
  base0: number
  base1: number
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

// Location-marker ladder. Markers are emitted every MARKER_SPACING_PX of
// average on-screen travel along a feature, and only for features at least
// MIN_MARKER_FEATURE_PX wide on average — a tick every 20px across a 25px
// ribbon says nothing a reader can use.
//
// BOTH are measured over the WHOLE FEATURE, never over a rendered CIGAR
// segment. That distinction is the bug this pair of constants exists to
// prevent: markers used to be emitted per rendered segment with the 30px gate
// applied per segment, and visitCigarRenderedSegments emits a segment as soon
// as either axis has advanced ~1px, so essentially every segment failed the
// gate. The visible effect was that turning CIGAR detail on (the default
// cigarMode is 'full') silently turned location markers OFF for every feature
// carrying a CIGAR — only a lone multi-megabase M/D/N op ever cleared 30px.
const MARKER_SPACING_PX = 20
const MIN_MARKER_FEATURE_PX = 30

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

  // Emit window for CIGAR detail segments and location markers (the base
  // trapezoid is not culled here — features this far off-screen were already
  // dropped by executeSyntenyFeaturesAndPositions). Same width-scaled buffer the
  // fetch window and that whole-feature cull use: a fixed 2000px was narrower
  // than both on a view wider than 4000px, and since the fetch key snaps to a
  // buffer-sized grid, a pan of up to syntenyPanBufferPx doesn't refetch — so
  // detail culled inside that distance left plain base ribbons at the leading
  // edge of the pan until the snapped window rolled over.
  const emitBufferPx = syntenyPanBufferPx(viewWidth)
  const emitLeft = -emitBufferPx
  const emitRight = viewWidth + emitBufferPx
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  // Per-axis fetch-time base cumBp (the viewport-start cumBp). Corners are
  // stored relative to this so on-screen magnitudes stay small (Float32-exact
  // without a hi/lo split). The main thread turns base into the panPx uniform.
  const base0 = viewOff0 * bpPerPx0
  const base1 = viewOff1 * bpPerPx1

  const alignmentLengths = new Float32Array(featureCount)
  // Per-feature: did we decide to draw CIGAR detail? Pass 1 always emits
  // KIND_BASE. When true, pass 2 runs the visitor and emits indel quads on top.
  const willDrawCigarArr = new Uint8Array(featureCount)
  // Per-feature: is this feature wide enough to carry a marker ladder? Decided
  // once here from the whole feature's width so the budget below and the two
  // emit sites cannot disagree about it — see MIN_MARKER_FEATURE_PX.
  const wantMarkersArr = new Uint8Array(featureCount)

  // Single pre-pass: fill alignmentLengths, willDrawCigar, wantMarkers, and
  // accumulate the exact upper-bound capacity. visitCigarRenderedSegments emits
  // a segment only when bp1 OR bp2 has advanced > 1 px from the segment start,
  // so per-feature visitor emissions are bounded by widthPx0 + widthPx1
  // regardless of CIGAR length. Markers are bounded by the ladder's own travel,
  // (widthPx0 + widthPx1) / 2 px at one per MARKER_SPACING_PX — a bound that
  // holds whether the ladder is fed one whole-feature span or every rendered
  // CIGAR segment, since the segments' widths sum to the feature's. These
  // bounds are strict, so a single allocation matches actual usage — no
  // growable buffers.
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
    // Gated on the same whole-feature width the ladder emits at, so a
    // whole-genome view of sub-pixel blocks doesn't reserve unused slots per
    // feature. The arrays are handed out as `subarray` views, so unused capacity
    // is not just allocated but transferred across the RPC boundary intact.
    //
    // The ladder walks (widthPx0 + widthPx1) / 2 px of travel at one marker per
    // MARKER_SPACING_PX, so twice that is a bound with room to spare — slack
    // that matters because a feature's CIGAR spans need not sum to exactly its
    // corner span, and addInstance drops silently past capacity.
    const wantMarkers =
      drawLocationMarkers && (widthPx0 + widthPx1) / 2 >= MIN_MARKER_FEATURE_PX
    wantMarkersArr[i] = wantMarkers ? 1 : 0
    const markerBudget = wantMarkers
      ? Math.ceil((widthPx0 + widthPx1) / MARKER_SPACING_PX) + 4
      : 0
    capacity += 1 + cigarBudget + markerBudget
  }

  // Write window-relative bp (cumBp - base) directly at emit time. The shader
  // reconstructs screen pixel via `bp*bpPerPxInv + panPx`, so the worker never
  // materializes Float64 pixel staging arrays and no hi/lo split is needed —
  // the base subtraction (Float64, exact) happens inline in `addInstance`.
  const bp1Arr = new Float32Array(capacity)
  const bp2Arr = new Float32Array(capacity)
  const bp3Arr = new Float32Array(capacity)
  const bp4Arr = new Float32Array(capacity)
  const kindsArr = new Uint8Array(capacity)
  const featIdxArr = new Uint32Array(capacity)
  const instanceAlignmentLengths = new Float32Array(capacity)

  let idx = 0

  // All four corner values are cumBp (bpBefore + bpOffset). Stored window-
  // relative: corners 1/2 use base0 (top view), 3/4 use base1 (bottom view).
  function addInstance(
    cumBp1: number,
    cumBp2: number,
    cumBp3: number,
    cumBp4: number,
    kind: number,
    featureIdx: number,
    alignmentLength: number,
  ) {
    // The capacity bounds above are strict, so this never trips. It is here
    // because the failure mode otherwise is silent and far away: typed-array
    // writes past the end are no-ops while `idx` keeps counting, so
    // `subarray(0, instanceCount)` would hand the renderer a short array and
    // every corner read past the end would project as NaN.
    if (idx >= capacity) {
      return
    }
    bp1Arr[idx] = cumBp1 - base0
    bp2Arr[idx] = cumBp2 - base0
    bp3Arr[idx] = cumBp3 - base1
    bp4Arr[idx] = cumBp4 - base1
    kindsArr[idx] = kind
    featIdxArr[idx] = featureIdx
    instanceAlignmentLengths[idx] = alignmentLength
    idx++
  }

  // One feature's marker ladder, fed one span at a time. A CIGAR-less feature
  // feeds its single full span; a CIGAR one feeds every rendered segment in
  // order. Because `travelled` and `nextAt` persist across the calls, the ladder
  // is one ruler laid along the whole feature rather than a fresh one per span —
  // which is what lets it survive a CIGAR whose rendered segments are each ~1px
  // (see MARKER_SPACING_PX).
  //
  // Feeding the segments rather than the corners is also what makes the markers
  // TRUE: each tick's two endpoints are the pair the CIGAR actually aligns, so a
  // deletion shears the ladder exactly where the alignment shears. Interpolating
  // across the whole feature would draw an evenly-sheared ribbon over a
  // unevenly-aligned one.
  //
  // Off-screen spans must still be fed — they carry travel, and skipping them
  // would slide every later tick — so the emit cull is per marker, not per span.
  function createMarkerLadder(featureIdx: number, alignmentLength: number) {
    let travelled = 0
    let nextAt = 0

    // All four values are cumBp, in the natural pairing: bp1Start aligns to
    // bp2Start (t=0) and bp1End to bp2End (t=1).
    return function feedSpan(
      bp1Start: number,
      bp1End: number,
      bp2Start: number,
      bp2End: number,
    ) {
      const width1 = Math.abs(bp1End - bp1Start) * bpPerPxInv0
      const width2 = Math.abs(bp2End - bp2Start) * bpPerPxInv1
      const span = (width1 + width2) / 2
      if (span <= 0) {
        return
      }
      const spanEnd = travelled + span

      while (nextAt <= spanEnd) {
        const t = (nextAt - travelled) / span
        nextAt += MARKER_SPACING_PX
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

      travelled = spanEnd
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
  for (let i = 0; i < featureCount; i++) {
    const x11 = p11_cumBp[i]!
    const x12 = p12_cumBp[i]!
    const x21 = p21_cumBp[i]!
    const x22 = p22_cumBp[i]!
    const alignmentLength = alignmentLengths[i]!
    if (!isTiled(i)) {
      addInstance(x11, x12, x22, x21, KIND_BASE, i, alignmentLength)
    }
    // Only the no-CIGAR features ladder here; pass 2 ladders the rest along
    // their rendered segments, where the alignment is actually known.
    if (!willDrawCigarArr[i] && wantMarkersArr[i]) {
      const feedMarkerSpan = createMarkerLadder(i, alignmentLength)
      feedMarkerSpan(x11, x12, x21, x22)
    }
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

    const feedMarkerSpan = wantMarkersArr[i]
      ? createMarkerLadder(i, alignmentLength)
      : undefined

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
        }
        // Outside the cull: the ladder has to see every span to keep counting.
        feedMarkerSpan?.(segBp1Start, segBp1End, segBp2Start, segBp2End)
      },
    )
  }

  const instanceCount = idx

  return {
    bp1: bp1Arr.subarray(0, instanceCount),
    bp2: bp2Arr.subarray(0, instanceCount),
    bp3: bp3Arr.subarray(0, instanceCount),
    bp4: bp4Arr.subarray(0, instanceCount),
    base0,
    base1,
    kinds: kindsArr.subarray(0, instanceCount),
    instanceFeatureIdx: featIdxArr.subarray(0, instanceCount),
    alignmentLengths: instanceAlignmentLengths.subarray(0, instanceCount),
    instanceCount,
  }
}
