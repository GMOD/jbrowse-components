import {
  getPairedInsertSizeAndOrientationColor,
  getPairedInsertSizeColor,
  getPairedOrientationColor,
} from '../shared/color'
import { ChainStats, ReducedFeature } from '../shared/fetchChains'

// avoid drawing negative width features for SVG exports
export function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  fillColor?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (fillColor) {
    ctx.fillStyle = fillColor
  }

  ctx.fillRect(x, y, width, height)
}

export function strokeRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  strokeColor?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor
  }
  ctx.strokeRect(x, y, width, height)
}

export function getPairedColor({
  type,
  v0,
  v1,
  stats,
}: {
  type: string
  v0: ReducedFeature
  v1: ReducedFeature
  stats?: ChainStats
}): readonly [string, string] | undefined {
  if (type === 'insertSizeAndOrientation') {
    return getPairedInsertSizeAndOrientationColor(v0, v1, stats)
  } else if (type === 'orientation') {
    return getPairedOrientationColor(v0)
  } else if (type === 'insertSize') {
    return getPairedInsertSizeColor(v0, v1, stats)
  } else if (type === 'gradient') {
    const s = Math.min(v0.start, v1.start)
    const e = Math.max(v0.end, v1.end)
    return [
      `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,50%)`,
      `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,30%)`,
    ] as const
  }
  return undefined
}
