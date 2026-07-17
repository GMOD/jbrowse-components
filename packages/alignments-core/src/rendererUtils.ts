import { YSCALEBAR_LABEL_OFFSET } from './coverageDownsampling.ts'
import {
  FIELD_OFFSET_F32 as INDICATOR_FIELD,
  INSTANCE_STRIDE_F32 as INDICATOR_STRIDE,
} from './indicatorLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as INTERBASE_FIELD,
  INSTANCE_STRIDE_F32 as INTERBASE_STRIDE,
} from './interbaseHistogramLayout.generated.ts'
import {
  INDICATOR_TRIANGLE_H,
  drawIndicatorTriangle,
} from './labelConstants.ts'
import {
  FIELD_OFFSET_F32 as MOD_COV_FIELD,
  INSTANCE_STRIDE_F32 as MOD_COV_STRIDE,
} from './modCoverageLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as SNP_FIELD,
  INSTANCE_STRIDE_F32 as SNP_STRIDE,
} from './snpCoverageLayout.generated.ts'

import type { CigarOpDrawColors } from './labelConstants.ts'
import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

interface InterbaseDrawColors {
  insertion: string
  softclip: string
  hardclip: string
}

type Ctx = CanvasRenderingContext2D | SvgCanvas

export function getDevicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio : 2
}

export function coverageLayout(coverageHeight: number) {
  const effectiveH = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const bottom = coverageHeight - YSCALEBAR_LABEL_OFFSET
  return { effectiveH, bottom }
}

// colorType: 1=A 2=C 3=G 4=T 5=N. N and any unknown type fall back to the muted
// grey. Mirrors snpColor() in snpCoverage.slang so Canvas2D and GPU match.
export function snpColorForType(colorType: number, colors: CigarOpDrawColors) {
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
    // Kept inline rather than shared: this loop runs per covered bp, and
    // returning a {left,right} would allocate per bin (see CLAUDE.md).
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
    ctx.fillRect(
      px,
      bandTop,
      Math.max(px2 - px + widthCompensation, 1),
      bandBottom - bandTop,
    )
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
  colors: CigarOpDrawColors,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const segmentCount = buffer.byteLength / (SNP_STRIDE * 4)

  for (let i = 0; i < segmentCount; i++) {
    const off = i * SNP_STRIDE
    const pos = u32[off + SNP_FIELD.position]!
    // Both edges, ordered — see drawCoverageBins for why.
    const pxA = bpToX(pos)
    const pxB = bpToX(pos + 1)
    const px = Math.min(pxA, pxB)
    const px2 = Math.max(pxA, pxB)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const yOff = f32[off + SNP_FIELD.yOffset]!
    const segH = f32[off + SNP_FIELD.segHeight]!
    const relDepth = f32[off + SNP_FIELD.relDepth]!
    const barH = normalizeDepth(relDepth * regionMaxDepth) * effectiveH
    const segBottom = bottom - yOff * barH
    const segTop = segBottom - segH * barH
    ctx.fillStyle = snpColorForType(f32[off + SNP_FIELD.colorType]!, colors)
    ctx.fillRect(px, segTop, Math.max(px2 - px, 1), segBottom - segTop)
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
  const indicatorCount = buffer.byteLength / (INDICATOR_STRIDE * 4)
  for (let i = 0; i < indicatorCount; i++) {
    const off = i * INDICATOR_STRIDE
    const px = bpToX(u32[off + INDICATOR_FIELD.position]!)
    if (px >= 0 && px < viewWidth) {
      ctx.fillStyle =
        colorLut[f32[off + INDICATOR_FIELD.colorType]! - 1] ?? colorLut[0]!
      drawIndicatorTriangle(ctx, px)
    }
  }
}

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
  if (interbaseMaxCount === 0 || domainMax === 0) {
    return
  }

  // Inverted clip/insertion bars scale to half the coverage drawing height
  // (matches origin/main's `range: [0, height/2]`), so they grow with the
  // track rather than being clipped at a fixed pixel cap. The worker bakes each
  // bar as a fraction of the region's raw peak depth (interbaseMaxCount); divide
  // it back out and multiply by the display's autoscaled domain so the bars
  // track the same depth scale as the coverage bars (origin/main parity).
  const interbaseHeight =
    (coverageLayout(coverageHeight).effectiveH / 2) *
    (interbaseMaxCount / domainMax)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]
  const segmentCount = buffer.byteLength / (INTERBASE_STRIDE * 4)

  for (let i = 0; i < segmentCount; i++) {
    const off = i * INTERBASE_STRIDE
    const pos = u32[off + INTERBASE_FIELD.position]!
    // Unlike the bar layers, the mark here is a 1px bar centered on the bp
    // BOUNDARY, and bpToX(pos) is that boundary in either orientation — so `px`
    // stays the anchor. Only the cull needs both edges ordered: as `px > width
    // || px2 < 0` it assumed px < px2 and dropped marks at either viewport edge
    // on a reversed block.
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (Math.min(px, px2) > viewWidth || Math.max(px, px2) < 0) {
      continue
    }
    const yOffset = f32[off + INTERBASE_FIELD.yOffset]!
    const segH = f32[off + INTERBASE_FIELD.segHeight]!
    const colorType = f32[off + INTERBASE_FIELD.colorType]!
    const segTop = INDICATOR_TRIANGLE_H + yOffset * interbaseHeight
    const segHeight = segH * interbaseHeight
    ctx.fillStyle = colorLut[colorType - 1] ?? colorLut[0]!
    ctx.fillRect(px - 0.5, segTop, 1, segHeight)
  }
}

// See drawSnpSegments for the per-position fraction contract.
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
  const segmentCount = buffer.byteLength / (MOD_COV_STRIDE * 4)

  for (let i = 0; i < segmentCount; i++) {
    const off = i * MOD_COV_STRIDE
    const pos = u32[off + MOD_COV_FIELD.position]!
    // Both edges, ordered — see drawCoverageBins for why.
    const pxA = bpToX(pos)
    const pxB = bpToX(pos + 1)
    const px = Math.min(pxA, pxB)
    const px2 = Math.max(pxA, pxB)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const yOffset = f32[off + MOD_COV_FIELD.yOffset]!
    const h = f32[off + MOD_COV_FIELD.segHeight]!
    const relDepth = f32[off + MOD_COV_FIELD.relDepth]!
    const rgba = u32[off + MOD_COV_FIELD.packedColor]!
    const r = rgba & 0xff
    const g = (rgba >> 8) & 0xff
    const b = (rgba >> 16) & 0xff
    const a = ((rgba >> 24) & 0xff) / 255
    const barH = normalizeDepth(relDepth * regionMaxDepth) * effectiveH
    const segBottom = bottom - yOffset * barH
    const segTop = segBottom - h * barH
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`
    ctx.fillRect(px, segTop, Math.max(px2 - px, 1), segBottom - segTop)
  }
}
