import { types, onPatch, getRoot } from 'mobx-state-tree'
import { readConfObject, getConf } from '../../configuration'
import { ElementId } from '../../mst-types'

export function generateHierarchy(trackConfigurations) {
  const hierarchy = {}

  trackConfigurations.forEach(trackConf => {
    const categories = [...(readConfObject(trackConf, 'category') || [])]
    if (categories.length === 0) categories[0] = 'uncategorized'

    let currLevel = hierarchy
    let i = 0
    for (; i < categories.length; i += 1) {
      const category = categories[i]
      if (!currLevel[category]) currLevel[category] = {}
      currLevel = currLevel[category]
    }
    currLevel[
      readConfObject(trackConf, 'name') || trackConf._configId
    ] = trackConf
  })
  return hierarchy
}

export default pluginManager =>
  types.compose(
    'HierarchicalTrackSelectorDrawerWidget',
    types
      .model({
        id: ElementId,
        type: types.literal('HierarchicalTrackSelectorDrawerWidget'),
        collapsed: types.map(types.boolean), // map of category path -> boolean of whether it is collapsed
        filterText: '',
        view: types.reference(
          pluginManager.pluggableMstType('view', 'stateModel'),
        ),
      })
      .actions(self => ({
        afterAttach() {
          onPatch(self, patch => console.log(patch))
        },
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
      })),
  )
