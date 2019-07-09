import { types } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
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
      trackConfigurations(assemblyName) {
        if (!self.view) return []
        const session = getSession(self)
        const trackConfigurations = []
        session.configuration.assemblies.forEach(assemblyConf => {
          if (
            readConfObject(assemblyConf, 'assemblyName') === assemblyName ||
            readConfObject(assemblyConf, 'aliases').includes(assemblyName)
          )
            trackConfigurations.push(...assemblyConf.tracks)
        })

        const relevantTrackConfigurations = trackConfigurations.filter(
          conf => conf.viewType === self.view.type,
        )
        return relevantTrackConfigurations
      },

      get assemblyNames() {
        const assemblyNames = []
        self.view.displayedRegions.forEach(displayedRegion => {
          if (!assemblyNames.includes(displayedRegion.assemblyName))
            assemblyNames.push(displayedRegion.assemblyName)
        })
        return assemblyNames
      },

      connectionTrackConfigurations(connectionName, assemblyName) {
        if (!self.view) return []
        const session = getSession(self)
        const assemblyData =
          session.assemblyManager.assemblyData.get(assemblyName) || {}
        const aliases = assemblyData.aliases || []
        const trackConfigurations = []
        const connection = session.connections.get(connectionName)
        if (connection) {
          ;[assemblyName, ...aliases].forEach(an => {
            const assembly = connection.assemblies.get(an)
            if (assembly) trackConfigurations.push(...assembly.tracks)
          })
        }

        const relevantTrackConfigurations = trackConfigurations.filter(
          conf => conf.viewType === self.view.type,
        )
        return relevantTrackConfigurations
      },

      hierarchy(assemblyName) {
        return generateHierarchy(self.trackConfigurations(assemblyName))
      },

      connectionHierarchy(connection, assemblyName) {
        return generateHierarchy(
          self.connectionTrackConfigurations(connection, assemblyName),
        )
      },

      // This recursively gets tracks from lower paths
      allTracksInCategoryPath(path, connection, assemblyName) {
        let currentHier = connection
          ? self.connectionHierarchy(connection, assemblyName)
          : self.hierarchy(assemblyName)
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
