import { set1 } from '@jbrowse/core/ui/colors'
import { randomColor } from '@jbrowse/core/util/color'

import type { Source } from './types.ts'

/**
 * Applies a color palette to sources based on a metadata attribute.
 * Colors are assigned based on the frequency of values, with less common
 * values getting colors first from the set1 palette.
 *
 * @param sources - The source array to apply colors to
 * @param attribute - The metadata attribute to color by
 * @returns A new array of sources with colors applied
 */
export function applyColorPalette(sources: Source[], attribute: string) {
  if (!attribute || sources.length === 0) {
    return sources
  }

  // Check if any source has the attribute
  const hasAttribute = sources.some(source => attribute in source)
  if (!hasAttribute) {
    return sources
  }

  // Count occurrences of each value
  const counts = new Map<string, number>()
  for (const source of sources) {
    const key = String(source[attribute] ?? '')
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  // Create color map, sorting by frequency (least common first gets colors first)
  const colorMap = Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([key], idx) => [key, set1[idx] || randomColor(key)]),
  )

  // Apply colors to sources
  return sources.map(source => ({
    ...source,
    color: colorMap[String(source[attribute] ?? '')],
  }))
}
