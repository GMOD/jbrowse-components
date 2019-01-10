import { getRoot, types } from 'mobx-state-tree'
import { readConfObject } from '../../configuration'
import { ElementId } from '../../mst-types'

export function generateHierarchy(trackConfigurations) {
  const hierarchy = new Map()

  trackConfigurations.forEach(trackConf => {
    const categories = [...(readConfObject(trackConf, 'category') || [])]

    let currLevel = hierarchy
    for (let i = 0; i < categories.length; i += 1) {
      const category = categories[i]
      if (!currLevel.has(category)) currLevel.set(category, new Map())
      currLevel = currLevel.get(category)
    }
    currLevel.set(trackConf._configId, trackConf)
  })
  return hierarchy
}

export default pluginManager =>
  types
    .model('HierarchicalTrackSelectorDrawerWidget', {
      id: ElementId,
      type: types.literal('HierarchicalTrackSelectorDrawerWidget'),
      collapsed: types.map(types.boolean), // map of category path -> boolean of whether it is collapsed
      filterText: '',
      view: types.maybe(
        types.reference(pluginManager.pluggableMstType('view', 'stateModel')),
      ),
    })
    .actions(self => ({
      setView(view) {
        self.view = view
      },
      toggleCategory(pathName) {
        self.collapsed.set(pathName, !self.collapsed.get(pathName))
      },
      clearFilterText() {
        self.filterText = ''
      },
      setFilterText(newText) {
        self.filterText = newText
      },
    }))
    .views(self => ({
      get trackConfigurations() {
        if (!self.view) return []
        const root = getRoot(self)
        const trackConfigurations = root.configuration.tracks
        const relevantTrackConfigurations = trackConfigurations.filter(
          conf => conf.viewType === self.view.type,
        )
        return relevantTrackConfigurations
      },

      get hierarchy() {
        return generateHierarchy(self.trackConfigurations)
      },

      // This recursively gets tracks from lower paths
      allTracksInCategoryPath(path) {
        let currentHier = self.hierarchy
        path.forEach(pathItem => {
          currentHier = currentHier.get(pathItem) || new Map()
        })
        let tracks = {}
        currentHier.forEach((contents, name) => {
          if (contents._configId) {
            tracks[contents._configId] = contents
          } else {
            tracks = Object.assign(
              tracks,
              self.allTracksInCategoryPath(path.concat([name])),
            )
          }
        })
        return tracks
      },
    }))
