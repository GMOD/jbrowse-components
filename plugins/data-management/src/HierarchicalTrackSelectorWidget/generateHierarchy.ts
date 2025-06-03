import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import { matches } from './util'
import { sortConfs } from './sortUtils'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { MinimalModel, TreeNode } from './types'

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
  const {
    collapsed,
    filterText,
    activeSortTrackNames,
    activeSortCategories,
    view,
  } = model
  if (!view) {
    return []
  }
  const session = getSession(model)
  const viewTracks = view.tracks
  const confs = trackConfs.filter(conf => matches(filterText, conf, session))

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
            isOpenByDefault: !collapsed.get(id),
            menuItems,
            nestingLevel: categories.length - 1,
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
    const r = currLevel.children.findIndex(elt => elt.children.length)
    const idx = r === -1 ? currLevel.children.length : r
    currLevel.children.splice(idx, 0, {
      id: [extra, conf.trackId].filter(f => !!f).join(','),
      trackId: conf.trackId,
      name: getTrackName(conf, session),
      conf,
      checked: viewTracks.some(f => f.configuration === conf),
      children: [],
      nestingLevel: categories.length,
      type: 'track' as const,
    })
  }

  return hierarchy.children
}
