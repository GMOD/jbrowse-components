import { colord } from '@jbrowse/core/util/colord'

import type { Feature } from '@jbrowse/core/util'

// Parse any CSS color string to [r,g,b] tuple using colord
export function parseCssColor(color: string): [number, number, number] {
  const { r, g, b } = colord(color).toRgb()
  return [r, g, b]
}

export function baseToAscii(base: string) {
  return base.toUpperCase().charCodeAt(0)
}

// Compute effective strand from XS/TS/ts tags (better than raw strand for RNA-seq)
// XS = strand for sequence, TS = strand for template, ts = strand information
export function getEffectiveStrand(feature: Feature) {
  const tags = feature.get('tags') as Record<string, string> | undefined
  const fstrand = feature.get('strand') ?? 0
  const xs = tags?.XS || tags?.TS
  const ts = tags?.ts

  if (xs === '+') {
    return 1
  } else if (xs === '-') {
    return -1
  }
  return (ts === '+' ? 1 : ts === '-' ? -1 : 0) * fstrand
}

// Pair orientation encoding for shader
// Based on orientationTypes from util.ts - maps pair_orientation strings to integers
// Supports 'fr' orientation type (most common for Illumina)
export function pairOrientationToNum(pairOrientation: string | undefined) {
  if (!pairOrientation) {
    return 0 // unknown
  }
  // For 'fr' orientation type (standard Illumina):
  // F1R2, F2R1 -> LR (normal)
  // R1F2, R2F1 -> RL
  // F1F2, F2F1 -> RR (actually FF)
  // R1R2, R2R1 -> LL (actually RR)
  switch (pairOrientation) {
    case 'F1R2':
    case 'F2R1':
      return 1 // LR - normal
    case 'R1F2':
    case 'R2F1':
      return 2 // RL
    case 'F1F2':
    case 'F2F1':
      return 3 // RR (FF orientation)
    case 'R1R2':
    case 'R2R1':
      return 4 // LL (RR orientation)
    default:
      return 0 // unknown
  }
}
