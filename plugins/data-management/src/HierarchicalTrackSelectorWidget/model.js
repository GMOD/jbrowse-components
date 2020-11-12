import { types } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'

export function generateHierarchy(model, trackConfigurations, collapsed) {
  const hierarchy = { children: [] }

  trackConfigurations.forEach(trackConf => {
    const categories = [...(readConfObject(trackConf, 'category') || [])]
    if (trackConf.trackId.endsWith('sessionTrack')) {
      categories.unshift(' Session tracks')
    }
    let currLevel = hierarchy
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      const ret = currLevel.children.find(c => c.name === category)
      const id = categories.slice(0, i + 1).join(',')
      if (!ret) {
        const n = {
          children: [],
          name: category,
          id,
          state: { expanded: !collapsed.get(id) },
        }
        currLevel.children.push(n)
        currLevel = n
      } else {
        currLevel = ret
      }
    }

    currLevel.children.push({
      id: trackConf.trackId,
      name: readConfObject(trackConf, 'name'),
      conf: trackConf,
      selected: model.view.tracks.find(f => f.configuration === trackConf),
      children: [],
    })
  })

  return hierarchy.children
}

export default pluginManager =>
  types
    .model('HierarchicalTrackSelectorWidget', {
      id: ElementId,
      type: types.literal('HierarchicalTrackSelectorWidget'),
      collapsed: types.map(types.boolean),
      filterText: '',
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      collapsedCategories: types.map(types.string, types.boolean),
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
        const viewType = self.view.type

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

      get assemblyNames() {
        return self.view ? self.view.assemblyNames : []
      },

      connectionTrackConfigurations(connection) {
        if (!self.view) {
          return []
        }
        const trackConfigurations = connection.tracks

        const relevantTrackConfigurations = trackConfigurations.filter(
          trackConf => {
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

      hierarchy(assemblyName) {
        const hier = generateHierarchy(
          self,
          self.trackConfigurations(assemblyName),
          self.collapsed,
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
          self.collapsed,
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
