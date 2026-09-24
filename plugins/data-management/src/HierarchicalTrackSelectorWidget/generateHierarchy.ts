import { categoryId } from './util.ts'

import type { TrackNodeSource, TreeNode } from './types.ts'

interface NodeWithChildren {
  children: TreeNode[]
}

// trackSources arrive resolved, sorted and filtered (see model.hierarchy)
export function generateHierarchy(
  trackSources: TrackNodeSource[],
  groupId: string,
): TreeNode[] {
  const root: NodeWithChildren = { children: [] }
  const categoryMaps = new Map<NodeWithChildren, Map<string, TreeNode>>()

  for (const source of trackSources) {
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
