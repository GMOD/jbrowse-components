import type { TrackNodeSource, TreeNode } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

interface NodeWithChildren {
  children: TreeNode[]
}

export function generateHierarchy({
  trackSources,
  sessionTrackIds,
  filteredTrackSet,
  extra,
  noCategories,
}: {
  noCategories?: boolean
  trackSources: TrackNodeSource[]
  sessionTrackIds: Set<string>
  filteredTrackSet: Set<AnyConfigurationModel>
  extra?: string
}): TreeNode[] {
  const root: NodeWithChildren = { children: [] }
  const categoryMaps = new Map<NodeWithChildren, Map<string, TreeNode>>()

  // trackSources arrive resolved and sorted (see model.allTracks), so nothing
  // here reads a config or sorts; filtering preserves the order
  for (const source of trackSources.filter(s => filteredTrackSet.has(s.conf))) {
    const { conf, name, description } = source
    const { trackId } = conf
    const categories = sessionTrackIds.has(trackId)
      ? [' Session tracks', ...source.categories]
      : source.categories

    let currLevel: NodeWithChildren = root
    let nestingLevel = 0

    if (!noCategories) {
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
          const id = extra ? `${extra}-${categoryPath}` : categoryPath
          existing = {
            children: [],
            name: category,
            id,
            nestingLevel: i + 1,
            type: 'category' as const,
          }
          currLevel.children.push(existing)
          categoryMap.set(category, existing)
        }
        currLevel = existing
        nestingLevel = i + 1
      }
    }

    // push order is fine — sortedChildren() in flattenedItems re-groups
    // tracks before categories during virtual-scroll flattening
    currLevel.children.push({
      id: extra ? `${extra},${trackId}` : trackId,
      trackId,
      name,
      description,
      conf,
      children: [],
      nestingLevel: nestingLevel + 1,
      type: 'track' as const,
    })
  }

  return root.children
}
