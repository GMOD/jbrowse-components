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

export function drawCoverageBins(
  ctx: Ctx,
  buffer: ArrayBuffer,
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
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
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
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
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
) {
  if (interbaseMaxCount === 0) {
    return
  }

  const interbaseHeight = Math.min(interbaseMaxCount * 2, 20)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]
  const segmentCount = buffer.byteLength / (INTERBASE_STRIDE * 4)

  for (let i = 0; i < segmentCount; i++) {
    const off = i * INTERBASE_STRIDE
    const pos = u32[off + INTERBASE_FIELD.position]!
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (px > viewWidth || px2 < 0) {
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
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
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
