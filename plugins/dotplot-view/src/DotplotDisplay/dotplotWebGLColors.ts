import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

function cssColorToNormalized(color: string): [number, number, number, number] {
  const { r, g, b, a } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255, a]
}

function cssColorToNormalizedUint8(
  color: string,
): [number, number, number, number] {
  const { r, g, b, a } = colord(color).toRgb()
  return [r, g, b, Math.round(a * 255)]
}

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}

export function createColorFunction(
  colorBy: string,
  alpha: number,
  thresholds?: number[],
  palette?: string[],
  config?: AnyConfigurationModel,
) {
  const colorCache = new Map<string, [number, number, number, number]>()

  return (feature: any): [number, number, number, number] => {
    const cacheKey =
      colorBy === 'default' || colorBy === 'strand'
        ? colorBy
        : feature?.id?.() || String(Math.random())

    if (colorCache.has(cacheKey)) {
      return colorCache.get(cacheKey)!
    }

    let color = '#000000'

    if (colorBy === 'strand') {
      const strand = feature?.get?.('strand') ?? 1
      color = strand === -1 ? '#ff0000' : '#0000ff'
    } else if (colorBy === 'query') {
      const refName = feature?.get?.('refName') ?? ''
      color = getQueryColor(refName)
    } else if (colorBy === 'identity') {
      const identity = feature?.get?.('identity') ?? 0
      if (thresholds && palette) {
        for (let i = 0; i < thresholds.length; i++) {
          if (identity > thresholds[i]!) {
            color = palette[i] || '#000000'
            break
          }
        }
      }
      color = '#000000'
    } else if (colorBy === 'meanQueryIdentity') {
      const meanScore = feature?.get?.('meanScore') ?? 0
      const hue = meanScore * 200
      color = colord(`hsl(${hue}, 100%, 40%)`).toHex()
    } else if (colorBy === 'mappingQuality') {
      const mapQual = feature?.get?.('mappingQual') ?? 0
      color = colord(`hsl(${mapQual}, 100%, 40%)`).toHex()
    } else {
      color = '#808080'
    }

    const withAlpha = colord(color).alpha(alpha).toRgbString()
    const normalized = cssColorToNormalizedUint8(withAlpha)

    colorCache.set(cacheKey, normalized)
    return normalized
  }
}

export function colorToNormalizedRgba(
  color: string,
  alpha: number = 1,
): [number, number, number, number] {
  const c = colord(color).alpha(alpha)
  const { r, g, b, a } = c.toRgb()
  return [r / 255, g / 255, b / 255, a]
}

export function colorToUint8Rgba(
  color: string,
  alpha: number = 1,
): [number, number, number, number] {
  const c = colord(color).alpha(alpha)
  const { r, g, b, a } = c.toRgb()
  return [r, g, b, Math.round(a * 255)]
}
