import { getRoot, types } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { ElementId } from '@gmod/jbrowse-core/mst-types'

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
    currLevel.set(trackConf.configId, trackConf)
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
        types.reference(pluginManager.pluggableMstType('view', 'stateModel'), {
          onInvalidated(evt) {
            evt.removeRef()
          },
        }),
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
        const assemblyNames = []
        self.view.displayedRegions.forEach(displayedRegion => {
          if (!assemblyNames.includes(displayedRegion.assemblyName))
            assemblyNames.push(displayedRegion.assemblyName)
        })
        const root = getRoot(self)
        const trackConfigurations = []
        assemblyNames.forEach(assemblyName => {
          const assembly = root.configuration.assemblies.get(assemblyName)
          if (assembly) trackConfigurations.push(...assembly.tracks)
        })

        const relevantTrackConfigurations = trackConfigurations.filter(
          conf => conf.viewType === self.view.type,
        )
        return relevantTrackConfigurations
      },

      connectionTrackConfigurations(connectionName) {
        if (!self.view) return []
        const assemblyNames = []
        self.view.displayedRegions.forEach(displayedRegion => {
          if (!assemblyNames.includes(displayedRegion.assemblyName))
            assemblyNames.push(displayedRegion.assemblyName)
        })
        const root = getRoot(self)
        const trackConfigurations = []
        assemblyNames.forEach(assemblyName => {
          const connection = root.connections.get(connectionName)
          if (connection) {
            const assembly = connection.assemblies.get(assemblyName)
            if (assembly) trackConfigurations.push(...assembly.tracks)
          }
        })

        const relevantTrackConfigurations = trackConfigurations.filter(
          conf => conf.viewType === self.view.type,
        )
        return relevantTrackConfigurations
      },

      get hierarchy() {
        return generateHierarchy(self.trackConfigurations)
      },

      connectionHierarchy(connection) {
        return generateHierarchy(self.connectionTrackConfigurations(connection))
      },

      // This recursively gets tracks from lower paths
      allTracksInCategoryPath(path, connection) {
        let currentHier = connection
          ? self.connectionHierarchy(connection)
          : self.hierarchy
        path.forEach(pathItem => {
          currentHier = currentHier.get(pathItem) || new Map()
        })
        let tracks = {}
        currentHier.forEach((contents, name) => {
          if (contents.configId) {
            tracks[contents.configId] = contents
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
