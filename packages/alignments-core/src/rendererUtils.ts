import { coverageLayout, interbaseBarHeightPx } from './coverageBandBox.ts'
import {
  INSTANCE_OFFSET_F32 as INDICATOR_F32,
  INSTANCE_OFFSET_U32 as INDICATOR_U32,
  INSTANCE_STRIDE_BYTES as INDICATOR_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as INDICATOR_STRIDE,
} from './indicatorLayout.generated.ts'
import { interbaseEdgePx } from './interbaseEdge.generated.ts'
import {
  INSTANCE_OFFSET_F32 as SEGMENT_F32,
  INSTANCE_OFFSET_U32 as SEGMENT_U32,
  INSTANCE_STRIDE_BYTES as SEGMENT_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as SEGMENT_STRIDE,
} from './interbaseHistogramLayout.generated.ts'
import {
  INDICATOR_TRIANGLE_HW,
  drawIndicatorTriangle,
} from './labelConstants.ts'
import {
  INSTANCE_OFFSET_F32 as MOD_COV_F32,
  INSTANCE_OFFSET_U32 as MOD_COV_U32,
  INSTANCE_STRIDE_BYTES as MOD_COV_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as MOD_COV_STRIDE,
} from './modCoverageLayout.generated.ts'
import {
  INSTANCE_OFFSET_F32 as SNP_F32,
  INSTANCE_OFFSET_U32 as SNP_U32,
  INSTANCE_STRIDE_BYTES as SNP_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as SNP_STRIDE,
} from './snpCoverageLayout.generated.ts'

import type { SnpBaseColors } from './labelConstants.ts'
import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

interface InterbaseDrawColors {
  insertion: string
  softclip: string
  hardclip: string
}

type Ctx = CanvasRenderingContext2D | SvgCanvas

// Left edge of a mark whose width is about to be clamped to a 1px minimum.
// Sub-pixel marks are CENTERED on their span, which is what
// `expandMinWidthX` in alignmentsUniforms.slang does — anchoring at the left
// edge instead put every canvas2d coverage mark half a pixel right of the GPU's
// once the view passed 1bp/px, since that is where the clamp starts firing.
//
// It measured as the largest cross-backend divergence in the suite:
// `targeted_inversion-pbsim-coverage` went 16.71% -> 7.32% on centering these,
// and the residual is a separate bug (see the inversion-pbsim entry in
// browser-tests/crossBackendGate.ts). `drawInterbaseSegments` below already
// centered, with a comment saying so — these three call sites were the odd ones
// out, not the convention.
//
// Exported because the pileup's gap pass is a fourth call site in the same
// position — `gap.slang` widens through `expandMinWidthX` too — and it was left
// behind by that fix. Every Canvas2D mark whose GPU twin calls
// `expandMinWidthX` goes through here; the pileup's 1bp CELL layers
// deliberately do not (`makePileupCellMapper` floors one-sidedly, matching
// `mismatch.slang`'s snapped left edge — see the `js-skip: expandMinWidthX`
// note in alignmentsUniforms.slang).
//
// `w` is the mark's TRUE span, `px2 - px`, never a seam-fudged or already-
// clamped one: it is the sub-pixel *test*, and the shader tests the true span.
// Returns a number rather than a {left,width} pair: these loops run per covered
// bp, and an object per bin would allocate.
export function minWidthLeft(px: number, px2: number, w: number) {
  return w < 1 ? (px + px2) / 2 - 0.5 : px
}

/**
 * One sub-pixel-safe bar spanning ordered edges `px`..`px2`.
 *
 * The pivot and the 1px floor are ONE rule — the floor is what makes a mark
 * sub-pixel and the pivot is where it then goes — and holding them apart at each
 * call site is how the rule kept being applied half-right. Both halves have
 * shipped wrong separately: the gap pass took the floor without the centering
 * (ba14fd5669 fixed three sites and missed it), and the coverage bar had both
 * but handed the pivot a seam-fudged width, moving the switch from a 1px span to
 * a 0.2px one. Five call sites, one of them in another package; this is the rule
 * itself rather than a piece of it.
 *
 * `widthCompensation` widens the DRAWN bar only, never the sub-pixel test: the
 * test is `expandMinWidthX`'s and the shader tests the true span. That
 * separation is exactly what the coverage bar got wrong.
 *
 * Allocates nothing per call, which is the bar for sharing anything out of these
 * loops — they run per covered bp.
 */
export function fillSpanRect(
  ctx: Ctx,
  px: number,
  px2: number,
  top: number,
  height: number,
  widthCompensation = 0,
) {
  const w = px2 - px
  ctx.fillRect(
    minWidthLeft(px, px2, w),
    top,
    Math.max(w + widthCompensation, 1),
    height,
  )
}

// colorType: 1=A 2=C 3=G 4=T 5=N. N and any unknown type fall back to the muted
// grey. Mirrors snpColor() in snpCoverage.slang so Canvas2D and GPU match.
export function snpColorForType(colorType: number, colors: SnpBaseColors) {
  switch (colorType) {
    case 1:
      return colors.baseA
    case 2:
      return colors.baseC
    case 3:
      return colors.baseG
    case 4:
      return colors.baseT
    default:
      return colors.baseN
  }
}

// Canvas2D coverage buffer defers normalization to draw time to support log
// scaling without repacking. The GPU path pre-normalizes to 2 floats.
// Position is stored as uint32 (exact integer genomic coord) in the position
// slot; bandBottom and bandTop are raw depth values stored as float32.
export const CANVAS2D_COVERAGE = {
  STRIDE_F32: 3,
  FIELD: { position: 0, bandBottom: 1, bandTop: 2 },
} as const

// A coverage buffer in the CANVAS2D_COVERAGE layout (raw depth, 3-float). The
// nominal brand stops a GPU coverage buffer (relDepth, 2-float, from
// `packCoverageBinsForGpu`) being handed to `drawCoverageBins`, which reads them
// at incompatible offsets — a silent mis-render with no runtime error. The two
// casts below are the only ones: the layout boundary is enforced here so every
// consumer stays cast-free. The brand is erased at the worker transfer boundary.
declare const canvas2dCoverageBrand: unique symbol
export type Canvas2DCoverageBuffer = ArrayBuffer & {
  readonly [canvas2dCoverageBrand]: true
}

// Empty placeholder (no bins) carrying the Canvas2D coverage brand. A fresh
// buffer per call: the worker transfers these, which detaches them, so a shared
// singleton would throw DataCloneError on the second RPC reply.
export function emptyCanvas2DCoverageBuffer(): Canvas2DCoverageBuffer {
  return new ArrayBuffer(0) as Canvas2DCoverageBuffer
}

// Pack per-position depths into the Canvas2D coverage buffer that
// `drawCoverageBins` reads. Stores raw depth (not pre-normalized) so the
// normalizer — linear or log — is chosen at draw time. Co-located with the
// format constant + draw function so the layout has a single source of truth;
// `bandBottom`/`bandTop` make each bin a band, with `bandBottom` 0 for a plain
// depth bar. Distinct from the GPU `packCoverageBinsForGpu` (relDepth + 2-float
// shader layout) — don't feed a GPU coverage buffer to `drawCoverageBins`.
export function packCoverageBinsCanvas2D(
  depths: Float32Array,
  startPos: number,
): Canvas2DCoverageBuffer {
  const { STRIDE_F32, FIELD } = CANVAS2D_COVERAGE
  const n = depths.length
  const buf = new ArrayBuffer(n * STRIDE_F32 * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < n; i++) {
    const off = i * STRIDE_F32
    u32[off + FIELD.position] = startPos + i
    f32[off + FIELD.bandBottom] = 0
    f32[off + FIELD.bandTop] = depths[i]!
  }
  return buf as Canvas2DCoverageBuffer
}

/**
 * How much wider than its true span a Canvas2D coverage bar is drawn, so that
 * adjacent bars overlap instead of showing a seam.
 *
 * A Canvas2D-only correction, and the reason it has no GPU twin is the
 * compositing model rather than an oversight: sub-pixel bars tile at ~1px pitch,
 * and two opaque fills whose antialiased coverage of one pixel sums to 1
 * composite to 1-(1-a)(1-b) < 1 — a visible gap — where the shader resolves the
 * union coverage once and stays opaque. It goes into the WIDTH only, never into
 * the sub-pixel test (see `fillSpanRect`).
 *
 * Lives here, beside the one function that spends it, because both plugins
 * drawing a Canvas2D coverage band have to spend the SAME number: it was
 * `ALIGNMENTS_FUDGE_FACTOR` — an uncommented 0.8 named for its plugin rather
 * than its job — with MAF carrying its own literal 0.8 under a comment saying
 * "mirrors alignments", which is the shape a constant takes just before the two
 * copies stop matching.
 */
export const COVERAGE_BAR_SEAM_FUDGE_PX = 0.8

export function drawCoverageBins(
  ctx: Ctx,
  buffer: Canvas2DCoverageBuffer,
  normalizeDepth: (depth: number) => number,
  coverageHeight: number,
  coverageColor: string,
  bpToX: (bp: number) => number,
  viewWidth: number,
  widthCompensation = 0,
) {
  const { STRIDE_F32, FIELD } = CANVAS2D_COVERAGE
  const binCount = buffer.byteLength / (STRIDE_F32 * 4)
  if (binCount === 0) {
    return
  }
  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  ctx.fillStyle = coverageColor
  for (let i = 0; i < binCount; i++) {
    const off = i * STRIDE_F32
    const pos = u32[off + FIELD.position]!
    // bpToX(pos) is the bin's left edge on a forward block but its RIGHT edge
    // on a reversed one, so resolve both edges and order them. Anchoring at
    // bpToX(pos) with width px2-px put the bar a full bin off AND drove the
    // width negative, which `Math.max(..., 1)` then clamped to a 1px sliver —
    // the coverage histogram all but vanished on flipped regions past 1bp/px.
    // Ordering the edges also fixes the cull, which assumed px < px2 and so
    // dropped bins straddling either viewport edge when reversed.
    // The edge resolution stays inline — this loop runs per covered bp, and
    // returning a {left,right} would allocate per bin. `minWidthLeft` is shared
    // because it returns a number and so allocates nothing.
    const pxA = bpToX(pos)
    const pxB = bpToX(pos + 1)
    const px = Math.min(pxA, pxB)
    const px2 = Math.max(pxA, pxB)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const bandBottom =
      bottom - normalizeDepth(f32[off + FIELD.bandBottom]!) * effectiveH
    const bandTop =
      bottom - normalizeDepth(f32[off + FIELD.bandTop]!) * effectiveH
    // The seam fudge widens the bar; it must not also decide whether the bar is
    // sub-pixel. `minWidthLeft` mirrors `expandMinWidthX`, which centers at a
    // TRUE span under 1 CSS px — feeding it the fudged width moved that switch
    // to a span under 0.2px, so every bar between 1 and 5 bp/px stayed anchored
    // at its left edge where the GPU had centered it. That is the same
    // half-pixel offset the three call sites in this file were fixed for
    // (ba14fd5669); this one was fixed with the wrong width and so kept it over
    // most of the zoom range where the clamp fires. The fudge stays in the
    // WIDTH at every zoom: sub-pixel bars tile at ~1px pitch, and two opaque
    // fills whose antialiased coverage of one pixel sums to 1 composite to
    // 1-(1-a)(1-b) < 1, i.e. a visible seam.
    fillSpanRect(ctx, px, px2, bandTop, bandBottom - bandTop, widthCompensation)
  }
}

// yOffset/segHeight are fractions of THIS position's bar (per-position
// semantics). relDepth = totalDepthAtPos / regionMaxDepth feeds the bar height
// via `normalizeDepth(relDepth * regionMaxDepth)` (raw-depth normalizer).
// Mirrors snpCoverage.slang exactly. No depthFrac un-mixing, no parallel arrays.
export function drawSnpSegments(
  ctx: Ctx,
  buffer: ArrayBuffer,
  normalizeDepth: (rawDepth: number) => number,
  regionMaxDepth: number,
  coverageHeight: number,
  colors: SnpBaseColors,
  bpToX: (bp: number) => number,
  viewWidth: number,
  minFrequency = 0,
) {
  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const segmentCount = buffer.byteLength / SNP_STRIDE_BYTES

  for (let i = 0; i < segmentCount; i++) {
    const off = i * SNP_STRIDE
    const pos = u32[off + SNP_U32.position]!
    // Both edges, ordered — see drawCoverageBins for why.
    const pxA = bpToX(pos)
    const pxB = bpToX(pos + 1)
    const px = Math.min(pxA, pxB)
    const px2 = Math.max(pxA, pxB)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    // The allele-fraction floor, the twin of snpCoverage.slang's own test.
    // `segHeight` IS this allele's share of the position's depth, so the
    // setting needs no conversion, and skipping leaves the segments above it
    // where they were — the grey depth bar underneath is ungated, so a hidden
    // slice reads as reference rather than as a gap.
    if (f32[off + SNP_F32.segHeight]! < minFrequency) {
      continue
    }
    const barH =
      normalizeDepth(f32[off + SNP_F32.relDepth]! * regionMaxDepth) * effectiveH
    const segBottom = bottom - f32[off + SNP_F32.yOffset]! * barH
    const segTop = segBottom - f32[off + SNP_F32.segHeight]! * barH
    ctx.fillStyle = snpColorForType(f32[off + SNP_F32.colorType]!, colors)
    // No seam fudge here, unlike the depth bars above, and that is the right
    // answer rather than the one that was forgotten. The fudge pays for itself
    // only where a layer tiles: a depth bar exists at every covered bp, so
    // widening every one of them is always closing a seam. Segments are SPARSE
    // — one per (position, allele) — so the usual case is an isolated SNP
    // column with no abutting neighbour, and widening that one draws it 0.8px
    // wider than snpCoverage.slang does. That trades a divergence in the common
    // case for a seam in the rare one (a RUN of consecutive bp carrying the same
    // allele at the same stack height, i.e. a systematically mismatching
    // stretch). Both backends already agree on the min-width rule that does
    // apply: `fillSpanRect` mirrors `covSegQuad`'s `expandMinWidthX`.
    fillSpanRect(ctx, px, px2, segTop, segBottom - segTop)
  }
}

export function drawIndicators(
  ctx: Ctx,
  buffer: ArrayBuffer,
  colors: InterbaseDrawColors,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]
  const indicatorCount = buffer.byteLength / INDICATOR_STRIDE_BYTES
  for (let i = 0; i < indicatorCount; i++) {
    const off = i * INDICATOR_STRIDE
    const px = bpToX(u32[off + INDICATOR_U32.position]!)
    // The mark is a 7px triangle CENTERED on `px`, so the cull is its EXTENT,
    // not its center — a center just past an edge still shows several pixels
    // inside it. `indicator.slang` does no x-cull at all: it emits the triangle
    // and lets the scissor clip it, so testing the center alone dropped, here
    // and therefore in the SVG export, a sliver the GPU draws. Not just the two
    // ends of the canvas — every block boundary in a multi-region view is such
    // an edge, and the block clip rect already keeps the overhang honest.
    //
    // Unlike the bar layers above there is no reversed-block subtlety: a
    // triangle is symmetric about `px`, and `bpToX(pos)` is that bp boundary in
    // either orientation (same reason drawInterbaseSegments keeps `px` as its
    // anchor).
    if (
      px + INDICATOR_TRIANGLE_HW >= 0 &&
      px - INDICATOR_TRIANGLE_HW <= viewWidth
    ) {
      ctx.fillStyle =
        colorLut[f32[off + INDICATOR_F32.colorType]! - 1] ?? colorLut[0]!
      drawIndicatorTriangle(ctx, px)
    }
  }
}

// The draw loops above and below index the packed buffers inline against the
// generated per-view offset maps rather than through the generated
// `getInstance<Field>` accessors, which measured 0.56-0.62x on this loop's
// shape — see the note in `coverageGpuPacking.ts` and
// `plugins/alignments/benches/instanceAccessors.bench.ts`. These run per
// segment per frame.

// Half the width of one interbase bar. The bar is 1 CSS px centered on the bp
// boundary, matching interbaseHistogram.slang's `barW = 2.0 / u.canvasW` quad
// centered on `cx`. Named so the draw and its cull cannot disagree about how
// wide the mark they are placing is.
const INTERBASE_BAR_HALF_W = 0.5

export function drawInterbaseSegments(
  ctx: Ctx,
  buffer: ArrayBuffer,
  interbaseMaxCount: number,
  colors: InterbaseDrawColors,
  bpToX: (bp: number) => number,
  viewWidth: number,
  coverageHeight: number,
  domainMax: number,
) {
  const interbaseHeight = interbaseBarHeightPx(
    coverageHeight,
    interbaseMaxCount,
    domainMax,
  )
  if (interbaseHeight === 0) {
    return
  }
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]
  const segmentCount = buffer.byteLength / SEGMENT_STRIDE_BYTES

  for (let i = 0; i < segmentCount; i++) {
    const off = i * SEGMENT_STRIDE
    const pos = u32[off + SEGMENT_U32.position]!
    // Unlike the bar layers, the mark here is a 1px bar centered on the bp
    // BOUNDARY, and bpToX(pos) is that boundary in either orientation — so `px`
    // is both the anchor and the whole geometry, and the cull is the mark's own
    // extent, exactly as in drawIndicators above. It used to cull on the bp
    // CELL (`bpToX(pos)`..`bpToX(pos + 1)`), which is neither the drawn span nor
    // ordered on a reversed block: it dropped the half of a bar still showing at
    // either viewport edge — and every block boundary in a multi-region view is
    // such an edge — while interbaseHistogram.slang emits the quad and lets the
    // scissor clip it, so the GPU drew the sliver Canvas2D and the SVG export
    // did not.
    const px = bpToX(pos)
    if (
      px + INTERBASE_BAR_HALF_W < 0 ||
      px - INTERBASE_BAR_HALF_W > viewWidth
    ) {
      continue
    }
    const yOffset = f32[off + SEGMENT_F32.yOffset]!
    const segH = f32[off + SEGMENT_F32.segHeight]!
    const colorType = f32[off + SEGMENT_F32.colorType]!
    // Both edges snap to whole pixels — the ONE place in this file that has to.
    // `interbaseEdgePx` is interbaseHistogram.slang's own function, generated by
    // `pnpm gen:shaders`; see it for why the snap exists. It was spelled out
    // here as well, under a copy of that explanation, which is a twin of the
    // exact kind that produced the divergence in the first place.
    const segTop = interbaseEdgePx(yOffset, interbaseHeight)
    const segBottom = interbaseEdgePx(yOffset + segH, interbaseHeight)
    ctx.fillStyle = colorLut[colorType - 1] ?? colorLut[0]!
    ctx.fillRect(px - INTERBASE_BAR_HALF_W, segTop, 1, segBottom - segTop)
  }
}

// See drawSnpSegments for the per-position fraction contract, and for why
// neither segment layer takes the depth bar's seam fudge.
export function drawModCovSegments(
  ctx: Ctx,
  buffer: ArrayBuffer,
  normalizeDepth: (rawDepth: number) => number,
  regionMaxDepth: number,
  coverageHeight: number,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const segmentCount = buffer.byteLength / MOD_COV_STRIDE_BYTES

  for (let i = 0; i < segmentCount; i++) {
    const off = i * MOD_COV_STRIDE
    const pos = u32[off + MOD_COV_U32.position]!
    // Both edges, ordered — see drawCoverageBins for why.
    const pxA = bpToX(pos)
    const pxB = bpToX(pos + 1)
    const px = Math.min(pxA, pxB)
    const px2 = Math.max(pxA, pxB)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const rgba = u32[off + MOD_COV_U32.packedColor]!
    const r = rgba & 0xff
    const g = (rgba >> 8) & 0xff
    const b = (rgba >> 16) & 0xff
    const a = ((rgba >> 24) & 0xff) / 255
    const barH =
      normalizeDepth(f32[off + MOD_COV_F32.relDepth]! * regionMaxDepth) *
      effectiveH
    const segBottom = bottom - f32[off + MOD_COV_F32.yOffset]! * barH
    const segTop = segBottom - f32[off + MOD_COV_F32.segHeight]! * barH
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`
    fillSpanRect(ctx, px, px2, segTop, segBottom - segTop)
  }
}
