import { getQueryColor } from '@jbrowse/core/ui/colors'
import { tagColorPalette } from '@jbrowse/core/ui/theme'

export const TAG_COLOR_PALETTE = tagColorPalette

// Add any not-yet-seen value to the discovered value -> painted color map.
// Object.hasOwn, not `!map[value]`: a tag value like 'toString' or 'constructor'
// inherits a truthy value off Object.prototype, so the truthiness check would
// skip assigning it a color and leave the read on the no-tag fallback.
function addValues(
  currentMap: Record<string, string>,
  values: string[],
  colorFor: (value: string, index: number) => string,
) {
  const map = { ...currentMap }
  let next = Object.keys(map).length
  let added = false
  for (const value of values) {
    if (!Object.hasOwn(map, value)) {
      map[value] = colorFor(value, next)
      next++
      added = true
    }
  }
  return { map, added }
}

// Color by tag: values take palette slots in discovery order — the first value
// hit gets index 0, the eleventh wraps to index 0 again.
export function updateColorTagMap(
  currentMap: Record<string, string>,
  tags: string[],
) {
  return addValues(
    currentMap,
    tags,
    (_value, index) => TAG_COLOR_PALETTE[index % TAG_COLOR_PALETTE.length]!,
  )
}

// Chromosome painting (colorBy 'mateRefName'): each name hashes to its own
// stable color through the same `getQueryColor` that `buildReadTagColors` bakes
// into the reads and the synteny view uses for its Query mode, so the legend
// swatch is the color painted — no discovery-order dependence.
export function updateQueryNameColorMap(
  currentMap: Record<string, string>,
  names: string[],
) {
  return addValues(currentMap, names, getQueryColor)
}
