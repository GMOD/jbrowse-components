import { YSCALEBAR_LABEL_OFFSET } from './coverageDownsampling.ts'
import {
  FIELD_OFFSET_F32 as INDICATOR_FIELD,
  INSTANCE_STRIDE_F32 as INDICATOR_STRIDE,
} from './indicatorLayout.generated.ts'
import {
  INDICATOR_TRIANGLE_H,
  drawIndicatorTriangle,
} from './labelConstants.ts'
import {
  FIELD_OFFSET_F32 as MOD_COV_FIELD,
  INSTANCE_STRIDE_F32 as MOD_COV_STRIDE,
} from './modCoverageLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as NONCOV_FIELD,
  INSTANCE_STRIDE_F32 as NONCOV_STRIDE,
} from './noncovHistogramLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as SNP_FIELD,
  INSTANCE_STRIDE_F32 as SNP_STRIDE,
} from './snpCoverageLayout.generated.ts'

import type { CigarOpDrawColors } from './labelConstants.ts'
import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

export interface NoncovDrawColors {
  insertion: string
  softclip: string
  hardclip: string
}

type Ctx = CanvasRenderingContext2D | SvgCanvas

export function getDevicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio : 2
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const dpr = getDevicePixelRatio()
  const pw = Math.round(width * dpr)
  const ph = Math.round(height * dpr)
  const changed = canvas.width !== pw || canvas.height !== ph
  if (changed) {
    canvas.width = pw
    canvas.height = ph
  }
  return { pw, ph, changed }
}

export function coverageLayout(coverageHeight: number) {
  const effectiveH = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const bottom = coverageHeight - YSCALEBAR_LABEL_OFFSET
  return { effectiveH, bottom }
}

export function snpColorForType(colorType: number, colors: CigarOpDrawColors) {
  if (colorType === 1) {
    return colors.baseA
  } else if (colorType === 2) {
    return colors.baseC
  } else if (colorType === 3) {
    return colors.baseG
  }
  return colors.baseT
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
  binCount: number,
  normalizeDepth: (depth: number) => number,
  coverageHeight: number,
  coverageColor: string,
  bpToX: (bp: number) => number,
  viewWidth: number,
  widthCompensation: number = 0,
) {
  if (binCount === 0) {
    return
  }

  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)

  ctx.fillStyle = coverageColor
  const { STRIDE_F32, FIELD } = CANVAS2D_COVERAGE
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
    ctx.fillRect(px, bandTop, Math.max(px2 - px + widthCompensation, 1), bandBottom - bandTop)
  }
}

export function drawSnpSegments(
  ctx: Ctx,
  buffer: ArrayBuffer,
  segmentCount: number,
  depthScale: number,
  coverageHeight: number,
  colors: CigarOpDrawColors,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  if (segmentCount === 0) {
    return
  }

  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)

  for (let i = 0; i < segmentCount; i++) {
    const off = i * SNP_STRIDE
    const pos = u32[off + SNP_FIELD.position]!
    const yOff = f32[off + SNP_FIELD.yOffset]!
    const segH = f32[off + SNP_FIELD.segHeight]!
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const segBottom = bottom - yOff * depthScale * effectiveH
    const segTop = segBottom - segH * depthScale * effectiveH
    ctx.fillStyle = snpColorForType(f32[off + SNP_FIELD.colorType]!, colors)
    ctx.fillRect(px, segTop, Math.max(px2 - px, 1), segBottom - segTop)
  }
}

export function drawIndicators(
  ctx: Ctx,
  buffer: ArrayBuffer,
  indicatorCount: number,
  colors: NoncovDrawColors,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  if (indicatorCount === 0) {
    return
  }

  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]
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

export function drawNoncovSegments(
  ctx: Ctx,
  buffer: ArrayBuffer,
  segmentCount: number,
  noncovMaxCount: number,
  colors: NoncovDrawColors,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  if (segmentCount === 0 || noncovMaxCount === 0) {
    return
  }

  const noncovHeight = Math.min(noncovMaxCount * 2, 20)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]

  for (let i = 0; i < segmentCount; i++) {
    const off = i * NONCOV_STRIDE
    const pos = u32[off + NONCOV_FIELD.position]!
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const yOffset = f32[off + NONCOV_FIELD.yOffset]!
    const segH = f32[off + NONCOV_FIELD.segHeight]!
    const colorType = f32[off + NONCOV_FIELD.colorType]!
    const segTop = INDICATOR_TRIANGLE_H + yOffset * noncovHeight
    const segHeight = segH * noncovHeight
    ctx.fillStyle = colorLut[colorType - 1] ?? colorLut[0]!
    ctx.fillRect(px, segTop, Math.max(px2 - px, 1), segHeight)
  }
}

export function drawModCovSegments(
  ctx: Ctx,
  buffer: ArrayBuffer,
  segmentCount: number,
  depthScale: number,
  coverageHeight: number,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  if (segmentCount === 0) {
    return
  }

  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)

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
    const rgba = u32[off + MOD_COV_FIELD.packedColor]!
    const r = rgba & 0xff
    const g = (rgba >> 8) & 0xff
    const b = (rgba >> 16) & 0xff
    const a = ((rgba >> 24) & 0xff) / 255
    const segBottom = bottom - yOffset * depthScale * effectiveH
    const segTop = segBottom - h * depthScale * effectiveH
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`
    ctx.fillRect(px, segTop, Math.max(px2 - px, 1), segBottom - segTop)
  }
}
