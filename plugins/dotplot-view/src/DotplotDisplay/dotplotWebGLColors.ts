import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import type { DotplotFeatPos } from './types.ts'

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

const category10Normalized = category10.map(hex => {
  const { r, g, b } = colord(hex).toRgb()
  return [r / 255, g / 255, b / 255] as [number, number, number]
})

export function createDotplotColorFunction(
  colorBy: string,
  alpha: number,
): (f: DotplotFeatPos, index: number) => [number, number, number, number] {
  if (colorBy === 'strand') {
    return (f: DotplotFeatPos) => {
      const strand = f.f.get('strand')
      return strand === -1 ? [0, 0, 1, alpha] : [1, 0, 0, alpha]
    }
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, [number, number, number, number]>()
    return (f: DotplotFeatPos) => {
      const name = (f.f.get('refName') as string) || ''
      if (!colorCache.has(name)) {
        const hash = hashString(name)
        const [r, g, b] =
          category10Normalized[hash % category10Normalized.length]!
        colorCache.set(name, [r, g, b, alpha])
      }
      return colorCache.get(name)!
    }
  }

  if (colorBy === 'identity') {
    return (f: DotplotFeatPos) => {
      const identity = f.f.get('identity') as number | undefined
      if (identity !== undefined) {
        // HSL-based: higher identity = more green, lower = more red
        const hue = identity * 120
        const { r, g, b } = colord(`hsl(${hue}, 100%, 40%)`).toRgb()
        return [r / 255, g / 255, b / 255, alpha]
      }
      return [1, 0, 0, alpha]
    }
  }

  if (colorBy === 'meanQueryIdentity') {
    return (f: DotplotFeatPos) => {
      const score = f.f.get('meanScore') as number | undefined
      if (score !== undefined) {
        const { r, g, b } = colord(`hsl(${score * 200}, 100%, 40%)`).toRgb()
        return [r / 255, g / 255, b / 255, alpha]
      }
      return [1, 0, 0, alpha]
    }
  }

  if (colorBy === 'mappingQuality') {
    return (f: DotplotFeatPos) => {
      const qual = f.f.get('mappingQual') as number | undefined
      if (qual !== undefined) {
        const { r, g, b } = colord(`hsl(${qual}, 100%, 40%)`).toRgb()
        return [r / 255, g / 255, b / 255, alpha]
      }
      return [1, 0, 0, alpha]
    }
  }

  // Default: red
  return () => [1, 0, 0, alpha]
}
