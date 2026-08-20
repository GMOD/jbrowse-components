import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_INDEL_MASK,
  CIGAR_N,
  cigarWalkBp1,
  cigarWalkBp2,
  cigarWalkRev1,
  cigarWalkRev2,
  visitCigarRenderedSegments,
} from '@jbrowse/cigar-utils'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'
import { syntenyPanBufferPx } from '@jbrowse/synteny-core'

import { spanOutsideBand } from '../LinearSyntenyDisplay/shaders/syntenyTypes.js.generated.ts'
import {
  KIND_BASE,
  KIND_BASE_TILE,
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

// Location markers are the TOP PANEL'S RULER, continued down through the
// ribbons. A tick is drawn wherever a round genomic coordinate of the query
// axis falls inside an alignment, joining it to the coordinate the alignment
// pairs it with on the target axis — so a tick's top end sits on a labelled
// scalebar gridline and its bottom end says where that position went.
//
// 120 is LinearGenomeView's own scalebar contract (`makeTicks` asks
// `chooseGridPitch(bpPerPx, 120, 15)`), so the grid IS the ruler's rather than
// merely resembling it, at whatever pitch the current zoom put the ruler on. Its
// pitch is not the whole contract: the ruler has a PHASE too, and taking only
// the pitch left every tick one base off the gridline it continues — see
// RULER_GRID_ORIGIN.
//
// SUBDIVIDED, so a tick sits on every labelled gridline and several more
// between each adjacent pair — see MARKER_MIN_TICK_PX.
//
// What this replaced, and why the replacement is not a tuning change: markers
// used to be spaced by PIXELS along each drawn shape, one every 20px, with a
// "skip anything under 30px" gate — applied per rendered CIGAR segment. Since
// visitCigarRenderedSegments emits a segment as soon as either axis has
// advanced ~1px, essentially every segment failed that gate, so with the
// default cigarMode ('full') a feature carrying a CIGAR drew NO markers at all
// unless it happened to contain a lone multi-megabase op. Pixel spacing was
// also per-shape, so ticks restarted at every block boundary and slid under
// zoom: regularly spaced within one ribbon and unrelated between two.
const MARKER_GRID_MIN_MAJOR_PX = 120

// The tick spacing the subdivision has to keep, which is the ONLY thing
// separating the marker grid from the ruler's own minor gridlines.
//
// The ruler's own major pitch is >=120px, and on chooseGridPitch's 1/2/5 ladder
// it lands at 120-300px — so a 1400px frame has room for only 6-10 ticks, and
// any of those that falls in a gap between alignments (or outside the blocks
// whose mate is in the other panel's window at all) is one fewer line. Measured
// on the tutorial's own data, the HG002 maternal-vs-paternal chain: the 70kb
// frame drew 6 lines and the 9Mb 8p23 frame 7, which is EVERY tick the ruler
// offered — nothing was being dropped, there was simply nothing more to draw.
// The way to get more correspondence lines is a finer grid, not a looser gate.
//
// The subdivision is `chooseGridPitch`'s MINOR pitch — the finest whole-bp
// divisor of the major that keeps the ticks at least `minMinorPitchPx` apart —
// so the marker grid asks the ruler's own function for the ruler's own major
// pitch and moves only the minor floor, 15px to 30px. A divisor by
// construction: every labelled gridline keeps its tick. Swept from base-level
// zoom to whole-chromosome the answer is a FIFTH of the ruler's pitch at every
// zoom but the boundary ones — 30-50px, or 28-46 ticks across a 1400px frame.
//
// The MAJOR minimum stays the ruler's 120px, and moving it instead would not
// work: asking the ladder for a major of >=30px answers with a pitch that need
// not divide the ruler's, and ruler at 5000 against markers at 2000 puts ticks
// on 2000/4000/6000 while leaving the LABELLED 5000 gridline without one —
// giving up the whole point of using the ruler's grid.
//
// A HALF of the ruler's pitch, which the fifth replaced, put the ticks 60-150px
// apart. Counted along one scanline of the tutorial's 300kb pericentromere
// frame, that was about one tick per indel in the ribbon — enough to put a line
// on one side of an indel and nothing on the other, which is the arrangement in
// which a tick states a position and no pair of them states a shear. A fifth
// carries about two, so a reader can watch one line enter an indel and the next
// leave it.
//
// 30px is the floor because a tick is drawn at a fixed 0.25 alpha, and closer
// than that a run of them over one ribbon reads as hatching rather than as a set
// of positions.
//
// A hand-rolled `[10, 5, 2]` divisor search over the ruler's major pitch is what
// this floor used to feed, and that search was `chooseGridPitch`'s minor rule
// transliterated — same ladder, same whole-bp test, same pixel floor. Don't
// reintroduce it to express a different subdivision: whatever the marker grid
// wants, the ruler's minor gridlines want the same thing at a different floor,
// and one call says so. `markerRulerParity.test.ts` pins the property both
// spellings are for.
const MARKER_MIN_TICK_PX = 30

// A feature narrower than this on the QUERY AXIS draws no markers.
//
// Not a density rule — the >=30px pitch already spaces the ticks. It is that a
// tick is a 1px line, so on a block of comparable width the tick IS the block
// and marks nothing inside it; and that a whole-genome hairball would otherwise
// put one on every sub-pixel thread it crosses, at the markers' fixed 0.25 alpha
// over ribbons the thin-fade has taken down to 0.15 — a ruler louder than the
// data it rules. 30px is ~30 tick-widths, where a tick reads as a mark in a
// block rather than as an edge of it.
//
// It costs almost nothing, which is worth recording because the obvious first
// theory for "few markers on a fragmented alignment" is that this gate is eating
// them. Swept over the HG002 chain across chr8 with the panels mated (windows
// from 30kb to 9Mb, 1400px), of ~48,000 ruler ticks that had an alignment under
// them, 11 were rejected here. What actually limits the count is how many ticks
// the grid offers and whether a block with a mate in the other panel's window
// sits under each one.
//
// THE QUERY AXIS, not the average of the two, because that is the axis the grid
// is defined on: a tick's position is a query coordinate, so how much of the
// query axis the block occupies is what decides whether the tick lands inside
// it. Averaging in the target width let a block 10px wide on the query axis and
// 60px on the target clear the gate and take a tick at a query position it
// barely covers. Same quantity the budget below counts ticks with, so the gate
// and the count cannot disagree.
//
// Measured over the WHOLE FEATURE, never a rendered CIGAR segment; see above
// for what that distinction cost.
const MIN_MARKER_FEATURE_PX = 30

// The genomic coordinate the ruler's grid is in phase with, which is NOT zero.
//
// LinearGenomeView draws the gridline for a round coordinate N at the LEFT EDGE
// of the base it labels, i.e. at 0-based N-1: `makeTicks` walks multiples of the
// pitch and emits `{ base: base - 1 }`, `makeBlockTicks` places it at
// `(base - start) / bpPerPx`, and the scalebar labels it `base + 1`. So the grid
// is the coordinates congruent to -1 mod the pitch, and anchoring the ticks at
// multiples of the pitch instead put every one of them one base to the RIGHT of
// the gridline it is meant to continue.
//
// A base is a base, so this is invisible at the zooms these figures are usually
// read at — but the ruler's pitch floors at 5bp, and at base-level zoom (0.02
// bp/px) one base is 50px against a 250px pitch: a fifth of the way to the next
// tick, which is where the tick stops reading as that gridline at all.
export const RULER_GRID_ORIGIN = -1

// The marker grid's pitch in query-axis bp at this zoom: the query view's own
// scalebar pitch, subdivided.
//
// `minorPitch` is 0 when no divisor leaves both whole bp and 30px of room, which
// is the undivided ruler — so the ticks thin out to the labelled gridlines rather
// than crowding, and every zoom has an answer.
//
// The 5bp end is worth following through, because it is where whole-bp binds:
// chooseGridPitch floors its major at 5bp — the one odd value the 1/2/5 ladder
// can hand back — and base-level zoom reaches that floor, where a tick every
// 2.5bp would sit between bases and mark a coordinate that does not exist. 5
// divides, so the floor subdivides to whole single bases.
//
// Exported so the tests read the pitch from here rather than re-spelling the
// derivation: a test that computes its own expected grid cannot notice this one
// moving.
export function markerGridPitch(bpPerPx: number) {
  const { majorPitch, minorPitch } = chooseGridPitch(
    bpPerPx,
    MARKER_GRID_MIN_MAJOR_PX,
    MARKER_MIN_TICK_PX,
  )
  // 0 is chooseGridPitch's "no whole-bp divisor leaves 30px of room" answer,
  // i.e. the undivided ruler — a sentinel, not a pitch of zero.
  return minorPitch === 0 ? majorPitch : minorPitch
}

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
  queryGridAnchors,
  strands,
  parsedCigars,
  starts,
  ends,
  drawCIGAR,
  drawCIGARMatchesOnly,
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
  // Per feature, the query axis's cumBp at RULER_GRID_ORIGIN of the displayed
  // region it was placed in (`cumBpAtGenomicCoord`). Only its residue mod the
  // grid pitch is read: it is what turns "a gridline of this chromosome's
  // scalebar" into "this cumBp", and it is per feature because a view can show
  // several regions at once, each with its own offset into cumBp.
  queryGridAnchors: Float64Array
  strands: Int8Array
  parsedCigars: ArrayLike<number>[]
  starts: Uint32Array
  ends: Uint32Array
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
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
  //
  // The comparison itself is `spanOutsideBand`, the shader's own — the same
  // function the two draw-time culls (isCulled, isRibbonCulled) ask, differing
  // only in the pad they hand it. This used to be an open-coded pair of
  // comparisons against precomputed edges at each of the two emit sites below.
  const emitBufferPx = syntenyPanBufferPx(viewWidth)
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  // cumBp -> screen px on each axis, which every cull below is expressed in.
  // Named so the marker cull and the segment cull are visibly the same
  // comparison at two pads rather than four open-coded copies of the projection.
  const screenX0 = (cumBp: number) => cumBp * bpPerPxInv0 - viewOff0
  const screenX1 = (cumBp: number) => cumBp * bpPerPxInv1 - viewOff1

  // Per-axis fetch-time base cumBp (the viewport-start cumBp). Corners are
  // stored relative to this so on-screen magnitudes stay small (Float32-exact
  // without a hi/lo split). The main thread turns base into the panPx uniform.
  const base0 = viewOff0 * bpPerPx0
  const base1 = viewOff1 * bpPerPx1

  // One pitch for the whole build: it is the query view's ruler, and the ruler
  // does not change per feature.
  //
  // A degenerate query axis has no grid, and saying so once here is what keeps
  // every budget below an integer: bpPerPx0 of 0 sends the pitch to Infinity and
  // the width to Infinity with it, so the per-feature `Math.ceil(width / pitch)`
  // comes out NaN — and a NaN capacity allocates zero-length arrays that a
  // `>=` guard cannot catch, since every comparison against NaN is false.
  const markerPitchBp = markerGridPitch(bpPerPx0)
  const markerPitchPx = markerPitchBp * bpPerPxInv0
  const markerGridExists = markerPitchPx > 0 && Number.isFinite(markerPitchPx)

  // The stretch of the QUERY AXIS a tick can be emitted over, so both the ladder
  // below and the budget it is sized against are bounded by the viewport rather
  // than by how wide the alignment is.
  //
  // Every other budget here is already bounded by something: a ribbon is one per
  // feature, and `cigarBudget` takes a `min` against the CIGAR's own length. The
  // marker ladder was bounded by the feature's whole width, which is not a
  // viewport quantity — a CIGAR-less block wider than the window keeps its full
  // corner span, because `clipLargeBlockToWindow` re-anchors only blocks that
  // carry a CIGAR. Measured: one 40Mb CIGAR-less block at 1bp/px reserved
  // 1,000,003 slots (25MB across the seven lanes) to emit 85 ticks, and the
  // reservation scales with zoom — the same block at base-level zoom asks for
  // about a gigabyte, in a worker, and the lanes are handed out as `subarray`
  // views so the whole allocation crosses the RPC boundary.
  //
  // The bound is what the two DRAW-time marker rules leave room for, in view-0
  // screen px. A tick paints only if its hull meets the band (so one end is
  // within `overdrawPx` of it) AND its two ends are no further apart than the
  // view is wide (`markerTravelsTooFar`) — together those pin its top end to
  // `[-(overdrawPx + viewWidth), 2*viewWidth + overdrawPx]`. Each axis then pans
  // up to `emitBufferPx` before the fetch key rolls over, which moves the tick
  // relative to where it was emitted, so the fetch-time window is that widened
  // by the buffer on each side.
  //
  // `overdrawPx` is a draw parameter the worker does not have, and standing in
  // `emitBufferPx` for it assumes `overdrawPx <= emitBufferPx` — which is the
  // assumption the per-tick cull below already makes (its whole justification is
  // that the emit window IS the pan buffer), and which the overdraw slider caps
  // at. So this narrows nothing that was surviving to the screen.
  //
  // WHAT THIS COUPLES, and the reason to read the paragraph above before
  // touching either end: a FETCH-time window is now derived from a DRAW-time
  // rule. Loosen `markerTravelsTooFar` — raise the cap, make it depend on the
  // band's height instead of the view's width, drop it — and this window becomes
  // too narrow for the ticks that rule would now keep, which shows up as the
  // grid stopping short at the edges of a sheared view and nothing failing
  // anywhere. The old code had no such dependency because it over-emitted and
  // let the frame decide; that is what the allocation above cost.
  //
  // The safe direction if that rule ever moves is to widen this by another view
  // width or two rather than to re-derive it. The allocation stays bounded by
  // the viewport either way, which is the whole point — the constant is slack,
  // not a budget anyone is spending.
  //
  // 3 view widths and 4 buffers: 12,200px on a 1400px view, or ~400 ticks at the
  // 30px floor, against the 1,000,003 above.
  const markerWindowPx = 3 * viewWidth + 4 * emitBufferPx
  const markerWindowLoBp = (viewOff0 - viewWidth - 2 * emitBufferPx) * bpPerPx0
  const markerWindowHiBp =
    (viewOff0 + 2 * viewWidth + 2 * emitBufferPx) * bpPerPx0

  const alignmentLengths = new Float32Array(featureCount)
  // Per-feature: did we decide to draw CIGAR detail? The base ribbon is always
  // KIND_BASE. When true, the emit loop runs the visitor over the feature's
  // CIGAR and emits its indel quads on top of that base.
  const willDrawCigarArr = new Uint8Array(featureCount)
  // Per-feature: is this feature wide enough to carry a marker ladder? Decided
  // once here from the whole feature's width so the budget below and the two
  // emit sites cannot disagree about it — see MIN_MARKER_FEATURE_PX.
  const wantMarkersArr = new Uint8Array(featureCount)

  // Single pre-pass: fill alignmentLengths, willDrawCigar, wantMarkers, and
  // accumulate the exact upper-bound capacity. visitCigarRenderedSegments emits
  // a segment only when bp1 OR bp2 has advanced > 1 px from the segment start,
  // so per-feature visitor emissions are bounded by widthPx0 + widthPx1
  // regardless of CIGAR length. Markers are bounded by how many grid steps fit
  // in the feature's QUERY span — a bound that holds whether the grid is asked
  // over one whole-feature span or over every rendered CIGAR segment, since the
  // segments partition that same span (see `markerCapacity` below). These
  // bounds are strict, so a single allocation matches actual usage — no
  // growable buffers.
  //
  // TWO capacities, because the instances land in two regions of one allocation:
  // ribbons from the front, markers from `ribbonCapacity`. See the marker cursor
  // below for why markers have to be last.
  let ribbonCapacity = 0
  let markerCapacity = 0
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
    // Gated on the same whole-feature width the markers emit at, so a
    // whole-genome view of sub-pixel blocks doesn't reserve unused slots per
    // feature. The arrays are handed out as `subarray` views, so unused capacity
    // is not just allocated but transferred across the RPC boundary intact.
    //
    // NOT gated on whether the view is currently drawing markers. The toggle is a
    // color-lane decision on the main thread (`computeSyntenyColors` paints a
    // tick transparent when it is off), which is what keeps it off the RPC — see
    // the display model's `computedColors`. What that costs is the ticks of a
    // view that has them switched off, and MIN_MARKER_FEATURE_PX bounds it
    // tightly: a whole-genome hairball emits none at all, since nothing in it
    // clears 30px.
    //
    // Grid ticks inside a query-axis span number at most span/markerPitchPx + 1,
    // whether the span arrives whole or as the CIGAR segments that partition it
    // — the +2 is slack for the segments' floating point not summing to exactly
    // the corner span, and matters because addMarker drops silently past
    // capacity.
    //
    // The span counted is the feature's width INTERSECTED WITH the emit window,
    // which is the same clamp `emitGridMarkers` applies to the ladder — so the
    // gate, the count and the emit still cannot disagree, and a block far wider
    // than the viewport no longer reserves a slot per grid step across its whole
    // genomic span. See markerWindowPx.
    const wantMarkers = markerGridExists && widthPx0 >= MIN_MARKER_FEATURE_PX
    wantMarkersArr[i] = wantMarkers ? 1 : 0
    markerCapacity += wantMarkers
      ? Math.ceil(Math.min(widthPx0, markerWindowPx) / markerPitchPx) + 2
      : 0
    ribbonCapacity += 1 + cigarBudget
  }

  // Write window-relative bp (cumBp - base) directly at emit time. The shader
  // reconstructs screen pixel via `bp*bpPerPxInv + panPx`, so the worker never
  // materializes Float64 pixel staging arrays and no hi/lo split is needed —
  // the base subtraction (Float64, exact) happens inline in `writeInstance`.
  const capacity = ribbonCapacity + markerCapacity
  const bp1Arr = new Float32Array(capacity)
  const bp2Arr = new Float32Array(capacity)
  const bp3Arr = new Float32Array(capacity)
  const bp4Arr = new Float32Array(capacity)
  const kindsArr = new Uint8Array(capacity)
  const featIdxArr = new Uint32Array(capacity)
  const instanceAlignmentLengths = new Float32Array(capacity)
  // Every lane, for the one operation that has to touch all of them uniformly —
  // closing the gap between the two regions once both are written.
  const lanes = [
    bp1Arr,
    bp2Arr,
    bp3Arr,
    bp4Arr,
    kindsArr,
    featIdxArr,
    instanceAlignmentLengths,
  ]

  // Two cursors into one allocation. INSTANCE ORDER IS DRAW ORDER — the Canvas2D
  // loop walks it, and `interleaveInstances` packs the GPU buffer in it — so a
  // tick emitted beside its own feature is painted under every feature that comes
  // after it, and every feature bar the last one has something after it. A grid
  // that is under the ribbons for some features and over them for others is not
  // a ruler, so the ticks go at the END of the arrays, where both backends draw
  // them last for free — no extra pass, no second draw call, and no re-walking
  // the CIGARs a second pass would have cost.
  let idx = 0
  let markerIdx = ribbonCapacity

  // All four corner values are cumBp (bpBefore + bpOffset). Stored window-
  // relative: corners 1/2 use base0 (top view), 3/4 use base1 (bottom view).
  //
  // The alignment length is the parent feature's, so it is read here rather than
  // threaded through every caller: an instance's length lane is a copy of its
  // feature's, and there is no instance whose length is anything else.
  function writeInstance(
    slot: number,
    cumBp1: number,
    cumBp2: number,
    cumBp3: number,
    cumBp4: number,
    kind: number,
    featureIdx: number,
  ) {
    bp1Arr[slot] = cumBp1 - base0
    bp2Arr[slot] = cumBp2 - base0
    bp3Arr[slot] = cumBp3 - base1
    bp4Arr[slot] = cumBp4 - base1
    kindsArr[slot] = kind
    featIdxArr[slot] = featureIdx
    instanceAlignmentLengths[slot] = alignmentLengths[featureIdx]!
  }

  // The two capacity bounds above are strict, so neither guard here ever trips.
  // They are here because the failure mode otherwise is silent and far away:
  // typed-array writes past the end are no-ops while the cursor keeps counting,
  // so `subarray` would hand the renderer a short array and every corner read
  // past the end would project as NaN. The ribbon guard also has to hold for a
  // second reason — a ribbon past `ribbonCapacity` would land inside the marker
  // region and be overwritten by a tick.
  function addRibbon(
    cumBp1: number,
    cumBp2: number,
    cumBp3: number,
    cumBp4: number,
    kind: number,
    featureIdx: number,
  ) {
    if (idx < ribbonCapacity) {
      writeInstance(idx++, cumBp1, cumBp2, cumBp3, cumBp4, kind, featureIdx)
    }
  }

  function addMarker(markerBp1: number, markerBp2: number, featureIdx: number) {
    if (markerIdx < capacity) {
      writeInstance(
        markerIdx++,
        markerBp1,
        markerBp1,
        markerBp2,
        markerBp2,
        KIND_MARKER,
        featureIdx,
      )
    }
  }

  // Emit one feature's grid ticks over one span of it — the whole feature for a
  // CIGAR-less one, or a single rendered CIGAR segment. Ticks sit at multiples
  // of the pitch off this feature's grid anchor, so a span is asked only where
  // the grid falls INSIDE it: the answer does not depend on how the feature was
  // cut into spans, which is what makes ~1px CIGAR segments and one whole-feature
  // trapezoid produce the same ticks in the same places.
  //
  // Segments are nonetheless the better thing to feed, and are what the CIGAR
  // branch feeds: a tick found inside one is paired using that segment's own
  // correspondence, so it lands where the CIGAR actually sends it. The
  // whole-feature interpolation only has the corners, and smears a deletion
  // evenly across the ribbon instead of shearing at it.
  //
  // Half-open in the query axis, [lo, hi), so a tick on the boundary two
  // adjacent segments share is emitted by exactly one of them. A span with no
  // query travel at all — an insertion, which advances only the target axis —
  // therefore emits nothing, which is right: it occupies no query coordinate for
  // a query-coordinate grid to land on.
  function emitGridMarkers(
    featureIdx: number,
    bp1Start: number,
    bp1End: number,
    bp2Start: number,
    bp2End: number,
  ) {
    // Clamped to the emit window, so the walk is over what can be drawn rather
    // than over the alignment. One interval, shared by every span of every
    // feature, so it cannot break the half-open property above: intersecting a
    // partition with a common interval leaves it a partition.
    const lo = Math.max(Math.min(bp1Start, bp1End), markerWindowLoBp)
    const hi = Math.min(Math.max(bp1Start, bp1End), markerWindowHiBp)
    const anchor = queryGridAnchors[featureIdx]!
    // Grid steps landing in [lo, hi), as a count rather than a `break` on the
    // tick position: a non-finite corner would leave a position test never
    // satisfied and the loop spinning forever inside a worker, where the count
    // comes out NaN and runs zero times.
    const firstStep = Math.ceil((lo - anchor) / markerPitchBp)
    const stepCount = Math.ceil((hi - anchor) / markerPitchBp) - firstStep

    for (let n = 0; n < stepCount; n++) {
      const markerBp1 = anchor + (firstStep + n) * markerPitchBp
      // No zero-travel guard on the divide: a span with bp1End === bp1Start
      // leaves hi <= lo, so stepCount is not positive and this line is never
      // reached. That is the same fact the half-open note above states about
      // insertions, which are the only way to get one.
      const t = (markerBp1 - bp1Start) / (bp1End - bp1Start)
      const markerBp2 = bp2Start + (bp2End - bp2Start) * t

      // Culled by the HULL of the tick's two ends, which is the same rule both
      // renderers apply (isCulled in syntenyTypes.slang, isRibbonCulled in
      // syntenyRibbonPath.ts) — a marker is a line between one point per view, so
      // the segment between them is on screen whenever the two ends straddle the
      // band, even though NEITHER end is inside it. Testing the ends
      // individually and dropping the tick when both fail is the per-edge rule
      // for a ribbon, and it deleted exactly the ticks the renderers were fixed
      // to keep: on an inversion the two ends are pulled apart by up to the
      // ribbon's whole horizontal travel, so a tick well inside the frame at
      // mid-height can have both endpoints outside the band.
      //
      // The OTHER marker rule — the cap on how far a tick may travel between its
      // two ends — is not here, and deliberately: see the marker arm of
      // `isRibbonCulled`. That distance is a function of how far the two views
      // have panned APART, which changes without a refetch, so a fetch-time
      // answer to it goes stale on the pan that makes it wrong. The hull is safe
      // to answer here because the emit window IS the pan buffer: anything a pan
      // can bring on screen before the fetch key rolls over was emitted.
      const screenTopX = screenX0(markerBp1)
      const screenBottomX = screenX1(markerBp2)
      if (
        spanOutsideBand(
          Math.min(screenTopX, screenBottomX),
          Math.max(screenTopX, screenBottomX),
          viewWidth,
          emitBufferPx,
        )
      ) {
        continue
      }

      addMarker(markerBp1, markerBp2, featureIdx)
    }
  }

  // A CIGAR feature is "tiled": the CIGAR walk paints it one quad per match
  // segment instead of a single full-span base. Only transparent-indels mode
  // tiles — see cigarSegmentKind.
  function isTiled(i: number) {
    return drawCIGARMatchesOnly && !!willDrawCigarArr[i]
  }

  // The instance kind a rendered CIGAR segment contributes, or undefined to
  // skip it. The two display modes are exact complements:
  //   colored indels             -> paint indels colored; matches ride the
  //                                  feature's own full-span base
  //   transparent (matchesOnly)  -> paint matches as base color; indels left
  //                                  unpainted (see-through)
  // No seam results from tiling matches: KIND_BASE_HIDDEN was dropped because
  // *seamless* coverage needed every quad to tile perfectly (sub-pixel FP gaps
  // showed as stripes), whereas match segments only ever abut across a real
  // (>1px) indel — exactly where a gap is wanted.
  //
  // A match tile is KIND_BASE_TILE rather than KIND_BASE, which paints the same
  // and fades differently: a tile is one of many packed a perpendicular width
  // apart, so the renderers' 1px minimum footprint makes them overlap unless
  // each carries its own width in its alpha. thinWidthFade is where that is
  // spelled out.
  function cigarSegmentKind(op: number) {
    const isIndel = ((1 << op) & CIGAR_INDEL_MASK) !== 0
    // transparent: base color on matches only (indels stay see-through).
    // colored: indelKind per indel (undefined on matches -> the base covers).
    const transparentKind = isIndel ? undefined : KIND_BASE_TILE
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
    const topMin = screenX0(Math.min(bp1Start, bp1End))
    const topMax = screenX0(Math.max(bp1Start, bp1End))
    const botMin = screenX1(Math.min(bp2Start, bp2End))
    const botMax = screenX1(Math.max(bp2Start, bp2End))
    return (
      spanOutsideBand(topMin, topMax, viewWidth, emitBufferPx) &&
      spanOutsideBand(botMin, botMax, viewWidth, emitBufferPx)
    )
  }

  // ONE PASS, so a feature's base trapezoid and its own CIGAR quads stay
  // contiguous in the array and therefore in draw and pick order. DON'T SPLIT IT
  // BACK: a base pass followed by a quad pass puts every quad above every base
  // whatever feature each belongs to, which no ordering upstream can correct —
  // `compareDrawOrder` sorts a small inversion above a large match and the
  // match's own deletion quads still land on top of it and take the hover.
  //
  // Emitting the base first keeps a feature's indels over its own base, the one
  // thing the two passes were for. What they also did, and this deliberately
  // does not, is paint them over other features' bases.
  for (let i = 0; i < featureCount; i++) {
    const x11 = p11_cumBp[i]!
    const x12 = p12_cumBp[i]!
    const x21 = p21_cumBp[i]!
    const x22 = p22_cumBp[i]!
    // One full-span KIND_BASE trapezoid for gapless match-color coverage. Tiled
    // features skip it — their base is laid down per match segment below so the
    // intervening indels stay see-through.
    if (!isTiled(i)) {
      addRibbon(x11, x12, x22, x21, KIND_BASE, i)
    }
    const wantMarkers = !!wantMarkersArr[i]
    if (willDrawCigarArr[i]) {
      // The walk's start corner and per-axis direction, shared with the
      // dotplot's `buildLineSegments` off the same p11..p22 lanes — a
      // reverse-strand CIGAR does not begin at the (x11, x21) corner.
      const strand = strands[i]!
      visitCigarRenderedSegments(
        parsedCigars[i]!,
        cigarWalkBp1(x11, x12, strand),
        cigarWalkBp2(x21, x22, strand),
        bpPerPx0,
        bpPerPx1,
        cigarWalkRev1(x11, x12, strand),
        cigarWalkRev2(x21, x22, strand),
        (resolvedOp, segBp1Start, segBp1End, segBp2Start, segBp2End) => {
          if (
            !segmentOffScreen(segBp1Start, segBp1End, segBp2Start, segBp2End)
          ) {
            // cigarSegmentKind decides which segments draw and as what (colored
            // indels vs. base-tiled matches).
            const kind = cigarSegmentKind(resolvedOp)
            if (kind !== undefined) {
              addRibbon(segBp1Start, segBp1End, segBp2End, segBp2Start, kind, i)
            }
          }
          // Outside the cull: a marker is culled by its own hull, not by the
          // segment's — on a crossed ribbon a tick can leave the frame where its
          // segment stays, and vice versa.
          if (wantMarkers) {
            emitGridMarkers(i, segBp1Start, segBp1End, segBp2Start, segBp2End)
          }
        },
      )
    } else if (wantMarkers) {
      // No CIGAR, so the ladder goes over the whole feature; the branch above
      // ladders along the rendered segments, where the alignment is known.
      emitGridMarkers(i, x11, x12, x21, x22)
    }
  }

  // Close the gap the two regions leave. Both bounds are upper bounds, so the
  // ribbon region is usually short of `ribbonCapacity` — a tiled feature emits no
  // full-span base, an off-screen segment no quad — and the markers have to slide
  // down onto the end of it. One memmove per lane, over the MARKER block only,
  // which is the small one: a 1400px frame offers tens of ticks per feature
  // against up to thousands of CIGAR quads.
  const ribbonCount = idx
  const markerCount = markerIdx - ribbonCapacity
  if (markerCount > 0 && ribbonCount < ribbonCapacity) {
    for (const lane of lanes) {
      lane.copyWithin(ribbonCount, ribbonCapacity, markerIdx)
    }
  }
  const instanceCount = ribbonCount + markerCount

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
