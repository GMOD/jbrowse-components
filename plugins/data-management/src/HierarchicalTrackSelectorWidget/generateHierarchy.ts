import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

// locals
import { matches } from './util'

export type TreeNode = {
  name: string
  id: string
  conf?: AnyConfigurationModel
  checked?: boolean
  isOpenByDefault?: boolean
  children: TreeNode[]
}

export function generateHierarchy(
  model: {
    filterText: string
    view: { tracks: { configuration: AnyConfigurationModel }[] }
  },
  trackConfigurations: AnyConfigurationModel[],
  collapsed: { get: (arg: string) => boolean | undefined },
  extra?: string,
) {
  const hierarchy = { children: [] as TreeNode[] } as TreeNode
  const { filterText, view } = model
  const session = getSession(model)
  const viewTrackMap = Object.fromEntries(
    view.tracks.map(t => [t.configuration.trackId, t]),
  )

  trackConfigurations
    .filter(conf => matches(filterText, conf, session))
    .forEach(conf => {
      // copy the categories since this array can be mutated downstream
      const categories = [...(readConfObject(conf, 'category') || [])]

      // silly thing where if trackId ends with sessionTrack, then push it to
      // a category that starts with a space to force sort to the top...
      // double whammy hackyness
      if (conf.trackId.endsWith('sessionTrack')) {
        categories.unshift(' Session tracks')
      }

      let currLevel = hierarchy

      // find existing category to put track into or create it
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i]
        const ret = currLevel.children.find(c => c.name === category)
        const id = extra + '-' + categories.slice(0, i + 1).join(',')
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

      // using splice here tries to group leaf nodes above hierarchical nodes
      currLevel.children.splice(
        currLevel.children.findIndex(elt => elt.children.length),
        0,
        {
          id: conf.trackId,
          name: getTrackName(conf, session),
          conf,
          checked: !!viewTrackMap[conf.trackId],
          children: [],
        },
      )
    })

  return hierarchy.children
}
