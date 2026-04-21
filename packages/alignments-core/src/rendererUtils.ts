import { YSCALEBAR_LABEL_OFFSET } from './coverageDownsampling.ts'
import {
  INDICATOR_TRIANGLE_H,
  drawIndicatorTriangle,
} from './labelConstants.ts'

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

export function drawCoverageBins(
  ctx: Ctx,
  buffer: ArrayBuffer,
  binCount: number,
  normalizeDepth: (depth: number) => number,
  coverageHeight: number,
  coverageColor: string,
  bpToX: (bp: number) => number,
  viewWidth: number,
) {
  if (binCount === 0) {
    return
  }

  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const f32 = new Float32Array(buffer)

  ctx.fillStyle = coverageColor
  for (let i = 0; i < binCount; i++) {
    const off = i * 3
    const pos = f32[off]!
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const bandBottom = bottom - f32[off + 1]! * effectiveH
    const bandTop = bottom - normalizeDepth(f32[off + 2]!) * effectiveH
    ctx.fillRect(px, bandTop, Math.max(px2 - px, 1), bandBottom - bandTop)
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
  const f32 = new Float32Array(buffer)

  for (let i = 0; i < segmentCount; i++) {
    const off = i * 4
    const pos = f32[off]!
    const yOff = f32[off + 1]!
    const segH = f32[off + 2]!
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const segBottom = bottom - yOff * depthScale * effectiveH
    const segTop = segBottom - segH * depthScale * effectiveH
    ctx.fillStyle = snpColorForType(f32[off + 3]!, colors)
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

  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]
  for (let i = 0; i < indicatorCount; i++) {
    const px = bpToX(f32[i * 2]!)
    if (px >= 0 && px < viewWidth) {
      ctx.fillStyle = colorLut[f32[i * 2 + 1]! - 1] ?? colorLut[0]!
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
  const f32 = new Float32Array(buffer)
  const colorLut = [colors.insertion, colors.softclip, colors.hardclip]

  for (let i = 0; i < segmentCount; i++) {
    const off = i * 4
    const pos = f32[off]!
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const yOffset = f32[off + 1]!
    const segH = f32[off + 2]!
    const colorType = f32[off + 3]!
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
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)

  for (let i = 0; i < segmentCount; i++) {
    const off = i * 4
    const pos = f32[off]!
    const px = bpToX(pos)
    const px2 = bpToX(pos + 1)
    if (px > viewWidth || px2 < 0) {
      continue
    }
    const yOffset = f32[off + 1]!
    const h = f32[off + 2]!
    const rgba = u32[off + 3]!
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
