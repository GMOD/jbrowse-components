import { types, getParent } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import intersect from 'array-intersection'

function passesFilter(filter, trackConf) {
  const name =
    readConfObject(trackConf, 'name') ||
    readConfObject(getParent(trackConf), 'name')
  const categories = readConfObject(trackConf, 'category') || []
  const regexp = new RegExp(filter, 'i')
  return (
    !!name.match(regexp) || categories.filter(cat => !!cat.match(regexp)).length
  )
}

export function generateHierarchy(model, trackConfigurations, collapsed) {
  const hierarchy = { children: [] }
  const { filterText, view } = model

  trackConfigurations
    .filter(trackConf => passesFilter(filterText, trackConf))
    .forEach(trackConf => {
      const categories = [...(readConfObject(trackConf, 'category') || [])]

      // silly thing where if trackId ends with sessionTrack, then push it to
      // a category that starts with a space to force sort to the top...
      // double whammy hackyness
      if (trackConf.trackId.endsWith('sessionTrack')) {
        categories.unshift(' Session tracks')
      }

      let currLevel = hierarchy

      // find existing category to put track into or create it
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
        name:
          readConfObject(trackConf, 'name') ||
          `Reference sequence (${readConfObject(
            getParent(trackConf),
            'name',
          )})`,
        conf: trackConf,
        selected: view.tracks.find(f => f.configuration === trackConf),
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
      trackConfigurations(assemblyName) {
        if (!self.view) {
          return []
        }
        const session = getSession(self)
        const { tracks: trackConfigurations, assemblyManager } = session
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          return []
        }
        const refseq = self.getRefSeqTrackConf(assemblyName)
        // filter out tracks that don't match the current assembly (check all
        // assembly aliases) and display types
        return (refseq ? [refseq] : []).concat([
          ...trackConfigurations
            .filter(conf => {
              const trackConfAssemblies = readConfObject(conf, 'assemblyNames')
              const { allAliases } = assembly
              return intersect(allAliases, trackConfAssemblies).length > 0
            })
            .filter(conf => {
              const { displayTypes } = pluginManager.getViewType(self.view.type)
              const compatibleDisplays = displayTypes.map(
                display => display.name,
              )
              const trackDisplays = conf.displays.map(display => display.type)
              return intersect(compatibleDisplays, trackDisplays).length > 0
            }),
        ])
      },

      get assemblyNames() {
        return self.view ? self.view.assemblyNames : []
      },

      connectionTrackConfigurations(connection) {
        if (!self.view) {
          return []
        }
        const trackConfigurations = connection.tracks

        // filter out tracks that don't match the current display types
        return trackConfigurations.filter(conf => {
          const { displayTypes } = pluginManager.getViewType(self.view.type)
          const compatibleDisplays = displayTypes.map(display => display.name)
          const trackDisplays = conf.displays.map(display => display.type)
          return intersect(compatibleDisplays, trackDisplays).length > 0
        })
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
