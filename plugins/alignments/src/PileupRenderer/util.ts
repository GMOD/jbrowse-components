import { measureText } from '@jbrowse/core/util'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

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

export function getColorBaseMap(theme: Theme) {
  const { bases } = theme.palette
  return {
    A: bases.A.main,
    C: bases.C.main,
    G: bases.G.main,
    T: bases.T.main,
    deletion: '#808080', // gray
  }
}

export function getContrastBaseMap(theme: Theme) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(theme)).map(([key, value]) => [
      key,
      theme.palette.getContrastText(value),
    ]),
  )
}

export function shouldDrawSNPsMuted(type?: string) {
  return ['methylation', 'modifications'].includes(type || '')
}

export function shouldDrawIndels() {
  return true
}

export interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
}

// get width and height of chars the height is an approximation: width letter M
// is approximately the height
export function getCharWidthHeight() {
  const charWidth = measureText('A')
  const charHeight = measureText('M') - 2
  return { charWidth, charHeight }
}
