import { trackNameCollator as collator } from '../shared/collator.ts'

import type { TrackNodeSource } from './types.ts'

// sortName rather than the display name, so the unnamed reference sequence
// track sorts to the top (see trackNodeSourceFor)
export function sortSources(
  sources: TrackNodeSource[],
  sortNames: boolean,
  sortCategories: boolean,
) {
  if (!sortNames && !sortCategories) {
    return sources
  }
  const sorted = [...sources]
  if (sortNames) {
    sorted.sort((a, b) => collator.compare(a.sortName, b.sortName))
  }
  if (sortCategories) {
    // stable, so the name sort above survives within a category
    sorted.sort((a, b) => {
      const depth = Math.max(a.categories.length, b.categories.length)
      for (let i = 0; i < depth; i++) {
        const d = collator.compare(a.categories[i] ?? '', b.categories[i] ?? '')
        if (d !== 0) {
          return d
        }
      }
      return 0
    })
  }
  return sorted
}
