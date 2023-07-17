import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

// locals
import { matches } from './util'
import { HierarchicalTrackSelectorModel } from './model'

function sortConfs(confs: AnyConfigurationModel[]) {
  // uses readConfObject instead of getTrackName so that the undefined
  // reference sequence track is sorted to the top
  return confs
    .map(c => [c, readConfObject(c, 'name')])
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(a => a[0])
}

export type TreeNode = {
  name: string
  id: string
  conf?: AnyConfigurationModel
  checked?: boolean
  isOpenByDefault?: boolean
  children: TreeNode[]
}

export function generateHierarchy(
  model: { filterText: string; hierarchicalSort: boolean; view: any },
  trackConfs: AnyConfigurationModel[],
  collapsed: { get: (arg: string) => boolean | undefined },
  extra?: string,
) {
  const hierarchy = { children: [] as TreeNode[] } as TreeNode
  const { filterText, hierarchicalSort, view } = model
  const session = getSession(model)
  const viewTracks = view.tracks as { configuration: AnyConfigurationModel }[]
  const confs = trackConfs.filter(conf => matches(filterText, conf, session))

  // uses getConf
  for (const conf of hierarchicalSort ? sortConfs(confs) : confs) {
    // copy the categories since this array can be mutated downstream
    const categories = [...(readConfObject(conf, 'category') || [])]

    // hack where if trackId ends with sessionTrack, then push it to a
    // category that starts with a space to force sort to the top
    if (conf.trackId.endsWith('sessionTrack')) {
      categories.unshift(' Session tracks')
    }

    let currLevel = hierarchy

    // find existing category to put track into or create it
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      const ret = currLevel.children.find(c => c.name === category)
      const id = `${extra}-${categories.slice(0, i + 1).join(',')}`
      if (!ret) {
        const n = {
          children: [],
          name: category,
          id,
          isOpenByDefault: !collapsed.get(id),
        }
        currLevel.children.push(n)
        currLevel = n
      } else {
        currLevel = ret
      }
    }

    // uses splice to try to put all leaf nodes above "category nodes" if you
    // change the splice to a simple push and open
    // test_data/test_order/config.json you will see the weirdness
    const r = currLevel.children.findIndex(elt => elt.children.length)
    const idx = r === -1 ? currLevel.children.length : r
    currLevel.children.splice(idx, 0, {
      id: conf.trackId,
      name: getTrackName(conf, session),
      conf,
      checked: viewTracks.some(f => f.configuration === conf),
      children: [],
    })
  }

  return hierarchy.children
}
