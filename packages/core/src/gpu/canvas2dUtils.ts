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

export function getDpr() {
  return typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
}

export function prepareCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
) {
  const dpr = getDpr()
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

// 256-entry LUT factory for per-cell `rgba(...)` fillStyle strings, keyed by
// the same quantized index as `lookupColorRamp`. Hot loops in HiC/LD allocate
// one fillStyle per cell; with up to 256 unique outputs from a fixed ramp,
// caching brings 7-15x speedup on big matrices. Returned closure is meant to
// live for one draw call.
export function makeRampFillStyleLut(ramp: Uint8Array) {
  const lut: (string | undefined)[] = new Array(256)
  return (t: number) => {
    let idx = (t * 255 + 0.5) | 0
    if (idx < 0) {
      idx = 0
    } else if (idx > 255) {
      idx = 255
    }
    let s = lut[idx]
    if (s === undefined) {
      const o = idx * 4
      const a = ramp[o + 3]! / 255
      s = `rgba(${ramp[o]!},${ramp[o + 1]!},${ramp[o + 2]!},${a})`
      lut[idx] = s
    }
    return s
  }
}

export function bpToScreenPx(
  absBp: number,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
) {
  const frac = (absBp - regionStart) / (regionEnd - regionStart)
  const w = screenEndPx - screenStartPx
  return reversed ? screenEndPx - frac * w : screenStartPx + frac * w
}
