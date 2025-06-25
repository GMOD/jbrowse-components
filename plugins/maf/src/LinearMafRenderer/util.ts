import { measureText } from '@jbrowse/core/util'

import type { Theme } from '@mui/material'

export function getContrastBaseMap(theme: Theme) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(theme)).map(([key, value]) => [
      key,
      theme.palette.getContrastText(value),
    ]),
  )
}

export function getColorBaseMap(theme: Theme) {
  const { bases } = theme.palette
  return {
    a: bases.A.main,
    c: bases.C.main,
    g: bases.G.main,
    t: bases.T.main,
  }
}

export function fillRect(
  ctx: CanvasRenderingContext2D,
  l: number,
  t: number,
  w: number,
  h: number,
  cw: number,
  color?: string,
) {
  if (l + w < 0 || l > cw) {
    return
  }
  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillRect(l, t, w, h)
}

// get width and height of chars the height is an approximation: width letter M
// is approximately the height
export function getCharWidthHeight() {
  const charWidth = measureText('A')
  const charHeight = measureText('M') - 2
  return { charWidth, charHeight }
}
