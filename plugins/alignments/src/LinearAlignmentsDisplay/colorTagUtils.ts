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
    if (!map[value]) {
      map[value] = TAG_COLOR_PALETTE[next % TAG_COLOR_PALETTE.length]!
      next++
      added = true
    }
  }
  return { map, added }
}
