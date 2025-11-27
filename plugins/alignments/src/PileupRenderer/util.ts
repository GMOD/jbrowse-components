import { measureText } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

export function fillRectCtx(
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

export function fillTextCtx(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  cw: number,
  color?: string,
) {
  if (x < 0 || x > cw) {
    return
  }
  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillText(text, x, y)
}

export function getColorBaseMap(theme: Theme) {
  const { skip, deletion, insertion, hardclip, softclip, bases } = theme.palette
  return {
    A: bases.A.main,
    C: bases.C.main,
    G: bases.G.main,
    T: bases.T.main,
    deletion,
    insertion,
    hardclip,
    softclip,
    skip,
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

/**
 * Sets the standard monospace font used for rendering base letters in alignments
 * @param ctx - Canvas rendering context
 */
export function setAlignmentFont(ctx: CanvasRenderingContext2D) {
  ctx.font = 'bold 10px Courier New,monospace'
}

// get width and height of chars the height is an approximation: width letter M
// is approximately the height
export function getCharWidthHeight() {
  const charWidth = measureText('A')
  const charHeight = measureText('M') - 2
  return { charWidth, charHeight }
}
