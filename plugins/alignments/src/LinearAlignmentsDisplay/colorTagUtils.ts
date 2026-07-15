import { tagColorPalette } from '@jbrowse/core/ui/theme'

export const TAG_COLOR_PALETTE = tagColorPalette

export function updateColorTagMap(
  currentMap: Record<string, string>,
  tags: string[],
): { map: Record<string, string>; added: boolean } {
  const map = { ...currentMap }
  let next = Object.keys(map).length
  let added = false
  for (const value of tags) {
    // Object.hasOwn, not `!map[value]`: a tag value like 'toString' or
    // 'constructor' inherits a truthy value off Object.prototype, so the
    // truthiness check would skip assigning it a palette color and leave the
    // read on the no-tag fallback.
    if (!Object.hasOwn(map, value)) {
      map[value] = TAG_COLOR_PALETTE[next % TAG_COLOR_PALETTE.length]!
      next++
      added = true
    }
  }
  return { map, added }
}
