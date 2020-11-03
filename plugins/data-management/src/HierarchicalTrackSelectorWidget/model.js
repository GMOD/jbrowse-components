import { types } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'

export function generateHierarchy(trackConfigurations) {
  const hierarchy = new Map()

  trackConfigurations.forEach(trackConf => {
    const categories = [...(readConfObject(trackConf, 'category') || [])]
    if (trackConf.trackId.endsWith('sessionTrack')) {
      categories.unshift(' Session tracks')
    }

    let currLevel = hierarchy
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      if (!currLevel.has(category)) {
        currLevel.set(category, new Map())
      }
      currLevel = currLevel.get(category)
    }
    currLevel.set(trackConf.trackId, trackConf)
  })
  return hierarchy
}

export default pluginManager =>
  types
    .model('HierarchicalTrackSelectorWidget', {
      id: ElementId,
      type: types.literal('HierarchicalTrackSelectorWidget'),
      collapsed: types.map(types.boolean), // map of category path -> boolean of whether it is collapsed
      filterText: '',
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
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
      trackConfigurations(assemblyName, trackConfigurations) {
        if (!self.view) {
          return []
        }

        const relevantTrackConfigurations = trackConfigurations.filter(
          trackConf => {
            const trackConfAssemblies = readConfObject(
              trackConf,
              'assemblyNames',
            )
            if (!trackConfAssemblies.includes(assemblyName)) {
              return false
            }
            const viewType = pluginManager.getViewType(self.view.type)
            const compatibleDisplays = viewType.displayTypes.map(
              displayType => displayType.name,
            )
            for (const display of trackConf.displays) {
              if (compatibleDisplays.includes(display.type)) {
                return true
              }
            }
            return false
          },
        )
        return relevantTrackConfigurations
      },

      getRefSeqTrackConf(assemblyName) {
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        const trackConf = assembly?.configuration.sequence
        const viewType = pluginManager.getViewType(self.view.type)
        if (trackConf) {
          for (const display of trackConf.displays) {
            if (
              viewType.displayTypes.find(
                displayType => displayType.name === display.type,
              )
            ) {
              return trackConf
            }
          }
        }
        return undefined
      },

      get assemblyNames() {
        return self.view ? self.view.assemblyNames : []
      },

      connectionTrackConfigurations(connection) {
        if (!self.view) {
          return []
        }
        const trackConfigurations = connection.tracks

        const relevantTrackConfigurations = trackConfigurations.filter(
          conf => conf.viewType === self.view.type,
        )
        return relevantTrackConfigurations
      },

      hierarchy(assemblyName) {
        const session = getSession(self)
        return generateHierarchy(
          self.trackConfigurations(assemblyName, session.tracks),
        )
      },

      connectionHierarchy(connection) {
        return generateHierarchy(self.connectionTrackConfigurations(connection))
      },

      // This recursively gets tracks from lower paths
      allTracksInCategoryPath(path, connection, assemblyName) {
        let currentHier = connection
          ? self.connectionHierarchy(connection)
          : self.hierarchy(assemblyName)
        path.forEach(pathItem => {
          currentHier = currentHier.get(pathItem) || new Map()
        })
        let tracks = {}
        currentHier.forEach((contents, name) => {
          if (contents.trackId) {
            tracks[contents.trackId] = contents
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
