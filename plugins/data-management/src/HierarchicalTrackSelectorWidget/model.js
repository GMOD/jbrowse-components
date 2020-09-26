import { types } from 'mobx-state-tree'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import { ElementId } from '@gmod/jbrowse-core/util/types/mst'

export function generateHierarchy(model, trackConfigurations) {
  const hierarchy = []

  trackConfigurations.forEach(trackConf => {
    const categories = readConfObject(trackConf, 'category') || []
    let currLevel = hierarchy
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      const f = hierarchy.find(elt => elt.id === category)
      if (f) {
        currLevel = f
      } else {
        currLevel = {
          id: category,
          name: category,
          state: { expanded: true },
          children: [],
        }
        hierarchy.push(currLevel)
      }
    }
    const l = currLevel.children || currLevel
    l.push({
      id: trackConf.trackId,
      name: readConfObject(trackConf, 'name'),
      conf: trackConf,
      state: {
        selected: model.view.tracks.find(f => f.configuration === trackConf),
      },
      children: [],
    })
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
      trackConfigurations(assemblyName) {
        if (!self.view) {
          return []
        }
        const session = getSession(self)
        const trackConfigurations = session.tracks

        const relevantTrackConfigurations = trackConfigurations.filter(conf => {
          const assemblies = readConfObject(conf, 'assemblyNames')
          return (
            conf.viewType === self.view.type &&
            assemblies.includes(assemblyName)
          )
        })
        return relevantTrackConfigurations
      },

      get assemblyNames() {
        return self.view ? self.view.assemblyNames : []
      },

      connectionTrackConfigurations(connection) {
        if (!self.view) return []
        const trackConfigurations = connection.tracks

        const relevantTrackConfigurations = trackConfigurations.filter(
          conf => conf.viewType === self.view.type,
        )
        return relevantTrackConfigurations
      },

      hierarchy(assemblyName) {
        const hier = generateHierarchy(
          self,
          self.trackConfigurations(assemblyName),
        )

        const session = getSession(self)
        const conns = (session.connectionInstances.get(assemblyName) || []).map(
          (conn, index) => {
            const c = session.connections[index]
            return {
              id: c.connectionId,
              name: readConfObject(c, 'name'),
              children: this.connectionHierarchy(conn),
              state: {
                expanded: true,
              },
            }
          },
        )

        conns.forEach(conn => {
          hier.push(conn)
        })

        return hier
      },

      connectionHierarchy(connection) {
        return generateHierarchy(
          self,
          self.connectionTrackConfigurations(connection),
        )
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
