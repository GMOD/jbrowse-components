export const TAG_COLOR_PALETTE = [
  '#90caf9',
  '#f48fb1',
  '#a5d6a7',
  '#fff59d',
  '#ffab91',
  '#ce93d8',
  '#80deea',
  '#c5e1a5',
  '#ffe082',
  '#bcaaa4',
]

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
