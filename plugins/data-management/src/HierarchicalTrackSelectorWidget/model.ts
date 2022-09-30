import {
  types,
  getParent,
  getEnv,
  getSnapshot,
  Instance,
} from 'mobx-state-tree'
import {
  getConf,
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import PluginManager from '@jbrowse/core/PluginManager'

function hasAnyOverlap<T>(a1: T[] = [], a2: T[] = []) {
  return !!a1.find(value => a2.includes(value))
}

function passesFilter(filter: string, config: AnyConfigurationModel) {
  const categories = readConfObject(config, 'category') as string[] | undefined
  const filterLower = filter.toLowerCase()
  return (
    getTrackName(config).toLowerCase().includes(filterLower) ||
    !!categories?.filter(c => c.toLowerCase().includes(filterLower)).length
  )
}

function getTrackName(config: AnyConfigurationModel): string {
  if (!config.trackId) {
    throw new Error('not a track')
  }
  return (
    readConfObject(config, 'name') ||
    `Reference sequence (${
      readConfObject(getParent(config), 'displayName') ||
      readConfObject(getParent(config), 'name')
    })`
  )
}

export type TreeNode = {
  name: string
  id: string
  conf?: AnyConfigurationModel
  checked?: boolean
  isOpenByDefault?: boolean
  children: TreeNode[]
}

function filterTracks(
  tracks: AnyConfigurationModel[],
  self: { view: { type: string } },
  assemblyName: string,
) {
  const { assemblyManager } = getSession(self)
  const { pluginManager } = getEnv(self)
  const assembly = assemblyManager.get(assemblyName)

  if (!assembly) {
    return []
  }
  const { allAliases } = assembly
  return tracks
    .filter(c => hasAnyOverlap(allAliases, readConfObject(c, 'assemblyNames')))
    .filter(c => {
      const { displayTypes } = pluginManager.getViewType(self.view.type)
      const compatDisplays = displayTypes.map((d: { name: string }) => d.name)
      const trackDisplays = c.displays.map((d: { type: string }) => d.type)
      return hasAnyOverlap(compatDisplays, trackDisplays)
    })
}

export function generateHierarchy(
  model: HierarchicalTrackSelectorModel,
  trackConfigurations: AnyConfigurationModel[],
  collapsed: { get: (arg: string) => boolean | undefined },
) {
  const hierarchy = { children: [] as TreeNode[] } as TreeNode
  const { filterText, view } = model

  trackConfigurations
    .filter(conf => passesFilter(filterText, conf))
    .forEach(conf => {
      // copy the categories since this array can be mutated downstream
      const categories = [...(readConfObject(conf, 'category') || [])]

      // silly thing where if trackId ends with sessionTrack, then push it to
      // a category that starts with a space to force sort to the top...
      // double whammy hackyness
      if (conf.trackId.endsWith('sessionTrack')) {
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
            isOpenByDefault: !collapsed.get(id),
          }
          currLevel.children.push(n)
          currLevel = n
        } else {
          currLevel = ret
        }
      }
      const tracks = view.tracks as { configuration: AnyConfigurationModel }[]

      // using splice here tries to group leaf nodes above hierarchical nodes
      currLevel.children.splice(
        currLevel.children.findIndex(elt => elt.children.length),
        0,
        {
          id: conf.trackId,
          name: getTrackName(conf),
          conf,
          checked: !!tracks.find(f => f.configuration === conf),
          children: [],
        },
      )
    })

  return hierarchy.children
}

export default function stateTreeFactory(pluginManager: PluginManager) {
  return types
    .model('HierarchicalTrackSelectorWidget', {
      id: ElementId,
      type: types.literal('HierarchicalTrackSelectorWidget'),
      collapsed: types.map(types.boolean),
      filterText: '',
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .volatile(() => ({
      selection: [] as AnyConfigurationModel[],
    }))
    .actions(self => ({
      addToSelection(elt: AnyConfigurationModel[]) {
        self.selection = [...self.selection, ...elt]
      },
      removeFromSelection(elt: AnyConfigurationModel[]) {
        self.selection = self.selection.filter(f => !elt.includes(f))
      },
      clearSelection() {
        self.selection = []
      },
      setView(view: unknown) {
        self.view = view
      },
      toggleCategory(pathName: string) {
        self.collapsed.set(pathName, !self.collapsed.get(pathName))
      },
      clearFilterText() {
        self.filterText = ''
      },
      setFilterText(newText: string) {
        self.filterText = newText
      },
    }))
    .views(self => ({
      getRefSeqTrackConf(assemblyName: string) {
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        const trackConf = assembly?.configuration.sequence
        const viewType = pluginManager.getViewType(self.view.type)
        if (!trackConf) {
          return undefined
        }
        for (const display of trackConf.displays) {
          if (viewType.displayTypes.find(d => d.name === display.type)) {
            return trackConf
          }
        }
      },
    }))
    .views(self => ({
      trackConfigurations(assemblyName: string) {
        if (!self.view) {
          return []
        }
        const { tracks, assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          return []
        }
        const refseq = self.getRefSeqTrackConf(assemblyName)
        // filter out tracks that don't match the current assembly (check all
        // assembly aliases) and display types
        return (refseq ? [refseq] : []).concat([
          ...filterTracks(tracks, self, assemblyName),
        ])
      },

      get assemblyNames(): string[] {
        return self.view?.assemblyNames || []
      },

      connectionTrackConfigurations(
        assemblyName: string,
        connection: { tracks: AnyConfigurationModel[] },
      ) {
        if (!self.view) {
          return []
        }

        // filter out tracks that don't match the current display types
        return filterTracks(connection.tracks, self, assemblyName)
      },
    }))
    .views(self => ({
      hierarchy(assemblyName: string) {
        const hier = generateHierarchy(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self as any,
          self.trackConfigurations(assemblyName),
          self.collapsed,
        )

        const session = getSession(self)
        const { connectionInstances } = session

        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        const conns =
          (assembly &&
            connectionInstances
              ?.filter(c =>
                hasAnyOverlap(assembly.allAliases, getConf(c, 'assemblyNames')),
              )
              .map(c => ({
                // @ts-ignore
                id: getSnapshot(c).configuration,
                name: getConf(c, 'name'),
                children: this.connectionHierarchy(assemblyName, c),
                state: {
                  expanded: true,
                },
              }))) ||
          []

        return {
          name: 'Root',
          id: 'Root',
          children: [
            { name: 'Tracks', id: 'Tracks', children: hier },
            ...conns,
          ],
        }
      },

      connectionHierarchy(
        assemblyName: string,
        connection: { tracks: AnyConfigurationModel[] },
      ) {
        return generateHierarchy(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self as any,
          self.connectionTrackConfigurations(assemblyName, connection),
          self.collapsed,
        )
      },
    }))
}

export type HierarchicalTrackSelectorStateModel = ReturnType<
  typeof stateTreeFactory
>
export type HierarchicalTrackSelectorModel =
  Instance<HierarchicalTrackSelectorStateModel>
