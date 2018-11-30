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
        view: types.reference(
          types.union(
            ...pluginManager.getElementTypeMembers('view', 'stateModel'),
          ),
        ),
      })
      .actions(self => ({
        afterAttach() {
          onPatch(self.collapsed, patch => console.log(patch))
        },
        setView(view) {
          self.view = view
        },
        toggleCategory(pathName) {
          self.collapsed.set(pathName, !self.collapsed.get(pathName))
        },
      }))
      .views(self => ({
        get hierarchy() {
          const root = getRoot(self)
          const trackConfigurations = root.configuration.tracks
          const relevantTrackConfigurations = trackConfigurations.filter(
            conf => conf.viewType === self.view.type,
          )
          return generateHierarchy(relevantTrackConfigurations)
        },
      })),
  )

//     .actions(self => ({
//       afterAttach() {
//         onAction(
//           getRoot(self).views.filter(v => v.id === self.id)[0],
//           call => {
//             if (call.name === 'set' && call.path.endsWith('category'))
//               this.addCategory(call.args[0][call.args[0].length - 1])
//           },
//         )
//         // If the above onAction is used to change a category for a track, there
//         // might now be unused categories. This triggers a cleanup after
//         // everything is done to keep unused categories from accumulating.
//         onAction(
//           getRoot(self).views.filter(v => v.id === self.id)[0],
//           call => {
//             if (call.name === 'set' && call.path.endsWith('category'))
//               this.reloadCategories()
//           },
//           true,
//         )
//         this.loadCategories()
//       },
//       loadCategories() {
//         const view = getRoot(self).views.filter(v => v.id === self.id)[0]
//         values(view.tracks).forEach(track => {
//           const categories = track.configuration.category.value
//           const category = categories[categories.length - 1]
//           if (category) this.addCategory(category)
//         })
//       },
//       reloadCategories() {
//         self.categories.clear()
//         this.loadCategories()
//       },
//       addCategory(name) {
//         if (!self.categories.has(name))
//           self.categories.set(name, Category.create({ id: name }))
//       },
//     })),
// )
