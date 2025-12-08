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

  // uses getConf
  for (const conf of sortConfs(
    confs,
    activeSortTrackNames,
    activeSortCategories,
  )) {
    // copy the categories since this array can be mutated downstream
    const categories = [...(readConfObject(conf, 'category') || [])]

    // hack where if trackId ends with sessionTrack, then push it to a
    // category that starts with a space to force sort to the top
    if (conf.trackId.endsWith('sessionTrack')) {
      categories.unshift(' Session tracks')
    }

    let currLevel = hierarchy

    if (!noCategories) {
      // find existing category to put track into or create it
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i]
        const ret = currLevel.children.find(c => c.name === category)
        const id = [extra, categories.slice(0, i + 1).join(',')]
          .filter(f => !!f)
          .join('-')
        if (!ret) {
          const n = {
            children: [],
            name: category,
            id,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            nestingLevel: (currLevel?.nestingLevel || 0) + 1,
            menuItems,
            type: 'category' as const,
          }
          currLevel.children.push(n)
          currLevel = n
        } else {
          currLevel = ret
        }
      }
    }

    // uses splice to try to put all leaf nodes above "category nodes" if you
    // change the splice to a simple push and open
    // test_data/test_order/config.json you will see the weirdness
    const leafCount = leafCounts.get(currLevel) ?? 0
    currLevel.children.splice(leafCount, 0, {
      id: [extra, conf.trackId].filter(f => !!f).join(','),
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
