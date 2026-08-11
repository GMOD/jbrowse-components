import { categoryId } from './util.ts'

import type { TrackNodeSource, TreeNode } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

interface NodeWithChildren {
  children: TreeNode[]
}

export function generateHierarchy({
  trackSources,
  filteredTrackSet,
  groupId,
}: {
  trackSources: TrackNodeSource[]
  filteredTrackSet: Set<AnyConfigurationModel>
  groupId: string
}): TreeNode[] {
  const root: NodeWithChildren = { children: [] }
  const categoryMaps = new Map<NodeWithChildren, Map<string, TreeNode>>()

  // trackSources arrive resolved and sorted (see model.allTracks), so nothing
  // here reads a config or sorts; filtering preserves the order
  for (const source of trackSources.filter(s => filteredTrackSet.has(s.conf))) {
    const { conf, categories } = source
    const { trackId } = conf

    let currLevel: NodeWithChildren = root
    let categoryPath = ''

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]!
      categoryPath = categoryPath ? `${categoryPath},${category}` : category

      let categoryMap = categoryMaps.get(currLevel)
      if (!categoryMap) {
        categoryMap = new Map()
        categoryMaps.set(currLevel, categoryMap)
      }

      let existing = categoryMap.get(category)
      if (!existing) {
        existing = {
          children: [],
          name: category,
          id: categoryId(groupId, categoryPath),
          nestingLevel: i + 1,
          type: 'category' as const,
        }
        currLevel.children.push(existing)
        categoryMap.set(category, existing)
      }
      currLevel = existing
    }

    // push order is fine — sortedTreeChildren() re-groups tracks before
    // categories while the model builds its rows
    currLevel.children.push({
      ...source,
      id: `${groupId},${trackId}`,
      trackId,
      children: [],
      // one level below its deepest category (or level 1 at the group root)
      nestingLevel: categories.length + 1,
      type: 'track' as const,
    })
  }

  return root.children
}
