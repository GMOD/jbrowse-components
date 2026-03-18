import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import { sortConfs } from './sortUtils.ts'
import { matches } from './util.ts'

import type { MinimalModel, TreeNode } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

export function generateHierarchy({
  model,
  trackConfs,
  extra,
  noCategories,
  menuItems,
}: {
  model: MinimalModel
  noCategories?: boolean
  menuItems?: MenuItem[]
  trackConfs: AnyConfigurationModel[]
  extra?: string
}): TreeNode[] {
  const hierarchy = { children: [] as TreeNode[] } as TreeNode
  const { filterText, activeSortTrackNames, activeSortCategories } = model
  const session = getSession(model)
  const confs = trackConfs.filter(conf => matches(filterText, conf, session))
  const leafCounts = new Map<TreeNode, number>()
  const categoryMaps = new Map<TreeNode, Map<string, TreeNode>>()

  for (const conf of sortConfs(
    confs,
    activeSortTrackNames,
    activeSortCategories,
  )) {
    const isSessionTrack = conf.trackId.endsWith('sessionTrack')
    const baseCategories = readConfObject(conf, 'category') ?? []
    const categories = isSessionTrack
      ? [' Session tracks', ...baseCategories]
      : baseCategories

    let currLevel = hierarchy
    let nestingLevel = 0

    if (!noCategories) {
      let categoryPath = ''
      for (const [i, category_] of categories.entries()) {
        const category = category_!
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
            menuItems,
            type: 'category' as const,
          } as TreeNode
          currLevel.children.push(existing)
          categoryMap.set(category, existing)
        }
        currLevel = existing
        nestingLevel = i + 1
      }
    }

    const leafCount = leafCounts.get(currLevel) ?? 0
    currLevel.children.splice(leafCount, 0, {
      id: extra ? `${extra},${conf.trackId}` : conf.trackId,
      trackId: conf.trackId,
      name: getTrackName(conf, session),
      conf,
      children: [],
      nestingLevel: nestingLevel + 1,
      type: 'track' as const,
    })
    leafCounts.set(currLevel, leafCount + 1)
  }

  return hierarchy.children
}
