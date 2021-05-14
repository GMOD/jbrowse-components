import { types, getParent } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'

const hasAnyOverlap = (a1 = [], a2 = []) =>
  !!a1.find(value => a2.includes(value))

function passesFilter(filter, config) {
  const name = getTrackName(config)
  const categories = readConfObject(config, 'category') || []
  const regexp = new RegExp(filter, 'i')
  return (
    !!name.match(regexp) || categories.filter(cat => !!cat.match(regexp)).length
  )
}

function getTrackName(config) {
  if (!config.trackId) {
    throw new Error('not a track')
  }
  return (
    readConfObject(config, 'name') ||
    `Reference sequence (${readConfObject(getParent(config), 'name')})`
  )
}

export function generateHierarchy(model, trackConfigurations, collapsed) {
  const hierarchy = { children: [] }
  const { filterText, view } = model

  trackConfigurations
    .filter(trackConf => passesFilter(filterText, trackConf))
    .forEach(trackConf => {
      // copy the categories since this array can be mutated downstream
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

      // using splice here tries to group leaf nodes above hierarchical nodes
      currLevel.children.splice(
        currLevel.children.findIndex(elt => elt.children.length),
        0,
        {
          id: trackConf.trackId,
          name: getTrackName(trackConf),
          conf: trackConf,
          checked: !!view.tracks.find(f => f.configuration === trackConf),
          children: [],
        },
      )
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
              return hasAnyOverlap(allAliases, trackConfAssemblies)
            })
            .filter(conf => {
              const { displayTypes } = pluginManager.getViewType(self.view.type)
              const compatibleDisplays = displayTypes.map(
                display => display.name,
              )
              const trackDisplays = conf.displays.map(display => display.type)
              return hasAnyOverlap(compatibleDisplays, trackDisplays)
            }),
        ])
      },

      get assemblyNames() {
        return self.view ? self.view.assemblyNames : []
      },

      connectionTrackConfigurations(assemblyName, connection) {
        if (!self.view) {
          return []
        }
        const trackConfigurations = connection.tracks
        const session = getSession(self)
        const { assemblyManager } = session
        const assembly = assemblyManager.get(assemblyName)

        if (!(assembly && assembly.initialized)) {
          return []
        }

        // filter out tracks that don't match the current display types
        return trackConfigurations
          .filter(conf => {
            const trackConfAssemblies = readConfObject(conf, 'assemblyNames')
            const { allAliases } = assembly
            return hasAnyOverlap(allAliases, trackConfAssemblies)
          })
          .filter(conf => {
            const { displayTypes } = pluginManager.getViewType(self.view.type)
            const compatibleDisplays = displayTypes.map(display => display.name)
            const trackDisplays = conf.displays.map(display => display.type)
            return hasAnyOverlap(compatibleDisplays, trackDisplays)
          })
      },

      hierarchy(assemblyName) {
        const hier = generateHierarchy(
          self,
          self.trackConfigurations(assemblyName),
          self.collapsed,
        )

        const session = getSession(self)
        const conns = session.connectionInstances
          .filter(conn => {
            const configAssemblyNames = readConfObject(
              conn.configuration,
              'assemblyNames',
            )
            if (configAssemblyNames.length === 0) {
              return true
            }
            return configAssemblyNames.includes(assemblyName)
          })
          .map((conn, index) => {
            const c = session.connections[index]
            return {
              id: c.connectionId,
              name: readConfObject(c, 'name'),
              children: this.connectionHierarchy(assemblyName, conn),
              state: {
                expanded: true,
              },
            }
          })

        return {
          name: 'Root',
          id: 'Root',
          children: [
            { name: 'Tracks', id: 'Tracks', children: hier },
            ...conns,
          ],
        }
      },

      connectionHierarchy(assemblyName, connection) {
        return generateHierarchy(
          self,
          self.connectionTrackConfigurations(assemblyName, connection),
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
