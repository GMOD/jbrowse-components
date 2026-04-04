export interface Canvas2DRenderBlock {
  screenStartPx: number
  screenEndPx: number
  bpRangeX: [number, number]
  reversed?: boolean
}

export interface BlockClip {
  scissorX: number
  scissorW: number
  fullBlockWidth: number
  bpLength: number
}

export function prepareCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
) {
  const dpr = window.devicePixelRatio || 1
  const bufW = Math.round(canvasWidth * dpr)
  const bufH = Math.round(canvasHeight * dpr)

  if (canvas.width !== bufW || canvas.height !== bufH) {
    canvas.width = bufW
    canvas.height = bufH
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
}

export function clipBlockForCanvas(
  block: Canvas2DRenderBlock,
  canvasWidth: number,
): BlockClip | null {
  const scissorX = Math.max(0, Math.floor(block.screenStartPx))
  const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
  const scissorW = scissorEnd - scissorX
  if (scissorW <= 0) {
    return null
  }

  return {
    scissorX,
    scissorW,
    fullBlockWidth: block.screenEndPx - block.screenStartPx,
    bpLength: block.bpRangeX[1] - block.bpRangeX[0],
  }
}

export function lookupColorRamp(ramp: Uint8Array, t: number) {
  const idx = Math.max(0, Math.min(255, Math.round(t * 255))) * 4
  return {
    r: ramp[idx]!,
    g: ramp[idx + 1]!,
    b: ramp[idx + 2]!,
    a: ramp[idx + 3]! / 255,
  }
}

export function lookupColorRampCSS(ramp: Uint8Array, t: number) {
  const { r, g, b, a } = lookupColorRamp(ramp, t)
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}

export function bpToScreenX(
  absBp: number,
  block: Canvas2DRenderBlock,
  bpLength: number,
  fullBlockWidth: number,
) {
  const frac = (absBp - block.bpRangeX[0]) / bpLength
  if (block.reversed) {
    return block.screenEndPx - frac * fullBlockWidth
  }
  return block.screenStartPx + frac * fullBlockWidth
}
