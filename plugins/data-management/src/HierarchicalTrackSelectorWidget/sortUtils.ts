import { naturalOrder } from '@jbrowse/core/util/tableText'

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
    sorted.sort((a, b) => naturalOrder(a.sortName, b.sortName))
  }
  if (sortCategories) {
    // stable, so the name sort above survives within a category
    sorted.sort((a, b) => {
      const depth = Math.max(a.categories.length, b.categories.length)
      for (let i = 0; i < depth; i++) {
        const d = naturalOrder(a.categories[i] ?? '', b.categories[i] ?? '')
        if (d !== 0) {
          return d
        }
      }
      return 0
    })
  }
  return sorted
}

/**
 * The order the tree draws tracks in: a category's own tracks, then each of
 * its subcategories in the order first seen. The table lists tracks this way
 * too, so its category column reads in runs.
 */
export function treeOrder(
  sources: TrackNodeSource[],
  depth = 0,
): TrackNodeSource[] {
  const byCategory = Map.groupBy(sources, s => s.categories[depth])
  return [
    ...(byCategory.get(undefined) ?? []),
    ...[...byCategory].flatMap(([category, members]) =>
      category === undefined ? [] : treeOrder(members, depth + 1),
    ),
  ]
}
