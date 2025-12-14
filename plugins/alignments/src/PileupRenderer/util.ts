import { measureText } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

export interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
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
