import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import { sortConfs } from './sortUtils'
import { matches } from './util'

import type { MinimalModel, TreeNode } from './types'
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

  // uses getConf
  for (const conf of sortConfs(
    confs,
    activeSortTrackNames,
    activeSortCategories,
  )) {
    const isSessionTrack = conf.trackId.endsWith('sessionTrack')
    const baseCategories = readConfObject(conf, 'category') ?? []
    // prepend session tracks category to force sort to the top
    const categories = isSessionTrack
      ? [' Session tracks', ...baseCategories]
      : baseCategories

    let currLevel = hierarchy

    if (!noCategories) {
      // find existing category to put track into or create it
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i]!
        let categoryMap = categoryMaps.get(currLevel)
        if (!categoryMap) {
          categoryMap = new Map()
          categoryMaps.set(currLevel, categoryMap)
        }
        const existing = categoryMap.get(category)
        if (existing) {
          currLevel = existing
        } else {
          const categoryPath = categories.slice(0, i + 1).join(',')
          const id = extra ? `${extra}-${categoryPath}` : categoryPath
          const n = {
            children: [],
            name: category,
            id,
            nestingLevel: (currLevel.nestingLevel ?? 0) + 1,
            menuItems,
            type: 'category' as const,
          } as TreeNode
          currLevel.children.push(n)
          categoryMap.set(category, n)
          currLevel = n
        }
      }
    }

    // uses splice to try to put all leaf nodes above "category nodes" if you
    // change the splice to a simple push and open
    // test_data/test_order/config.json you will see the weirdness
    const leafCount = leafCounts.get(currLevel) ?? 0
    currLevel.children.splice(leafCount, 0, {
      id: extra ? `${extra},${conf.trackId}` : conf.trackId,
      trackId: conf.trackId,
      name: getTrackName(conf, session),
      conf,
      children: [],
      nestingLevel: categories.length + 1,
      type: 'track' as const,
    })
    leafCounts.set(currLevel, leafCount + 1)
  }

  return hierarchy.children
}
