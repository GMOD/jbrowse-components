import { measureText } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

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

// Cache measureText results for small numbers (0-99)
// Most deletions are small, so this avoids calling measureText in hot loops
const smallNumberWidthCache10 = new Map<number, number>()
const smallNumberWidthCache = new Map<number, number>()

export function measureTextSmallNumber(n: number, fontSize?: number) {
  const cache =
    fontSize === 10 ? smallNumberWidthCache10 : smallNumberWidthCache
  if (n >= 0 && n < 100) {
    let width = cache.get(n)
    if (width === undefined) {
      width = measureText(String(n), fontSize)
      cache.set(n, width)
    }
    return width
  }
  return measureText(String(n), fontSize)
}
