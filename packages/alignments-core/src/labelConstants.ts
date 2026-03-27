export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15
export const MIN_HEIGHT_FOR_TEXT = 5

export const MISMATCH_COLOR = '#f00'
export const DELETION_COLOR = '#888'
export const INSERTION_COLOR = '#c000c0'
export const BASE_A_COLOR = '#00bf00'
export const BASE_C_COLOR = '#4747ff'
export const BASE_G_COLOR = '#d5bb04'
export const BASE_T_COLOR = '#f00'

export function computeLabelFontSize(h: number) {
  return Math.max(8, Math.min(h, 10))
}

// SYNC: mirrors textWidthForNumber() in GLSL/WGSL cigarShaders.ts
// charWidth=6px per digit + padding=10px
export function textWidthForNumber(num: number) {
  const charWidth = 6
  const padding = 10
  if (num < 10) {
    return charWidth + padding
  }
  if (num < 100) {
    return charWidth * 2 + padding
  }
  if (num < 1000) {
    return charWidth * 3 + padding
  }
  if (num < 10000) {
    return charWidth * 4 + padding
  }
  return charWidth * 5 + padding
}

interface DrawCtx {
  fillStyle: string | CanvasGradient | CanvasPattern
  font: string
  textAlign: string
  textBaseline: string
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number, maxWidth?: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
}

function drawSerifs(ctx: DrawCtx, px: number, y: number, h: number, triW: number) {
  ctx.beginPath()
  ctx.moveTo(px - triW, y)
  ctx.lineTo(px + triW, y)
  ctx.lineTo(px, y + triW)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px - triW, y + h)
  ctx.lineTo(px + triW, y + h)
  ctx.lineTo(px, y + h - triW)
  ctx.closePath()
  ctx.fill()
}

export function drawInsertion(
  ctx: DrawCtx,
  px: number,
  y: number,
  h: number,
  len: number,
  pxPerBp: number,
  color: string,
) {
  ctx.fillStyle = color
  const isLarge =
    len >= LONG_INSERTION_MIN_LENGTH &&
    len * pxPerBp >= LONG_INSERTION_TEXT_THRESHOLD_PX

  if (isLarge) {
    const boxW = textWidthForNumber(len)
    ctx.fillRect(px - boxW / 2, y, boxW, h)
    ctx.fillStyle = 'white'
    ctx.font = `${Math.min(9, h - 2)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${len}`, px, y + h / 2)
  } else {
    ctx.fillRect(px - 0.5, y, 1, h)
    if (h >= 6) {
      drawSerifs(ctx, px, y, h, Math.min(3, h / 3))
    }
    if (h >= MIN_HEIGHT_FOR_TEXT) {
      ctx.fillStyle = color
      ctx.font = `${Math.min(9, h - 2)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${len}`, px + 3, y + h / 2)
    }
  }
}
