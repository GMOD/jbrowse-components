import { types, getSnapshot, Instance } from 'mobx-state-tree'
import { getConf, AnyConfigurationModel } from '@jbrowse/core/configuration'
import { dedupe, getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { generateHierarchy, TreeNode } from './generateHierarchy'
import { relevantTracksForView } from './relevantTracksForView'

export default function stateTreeFactory(pluginManager: PluginManager) {
  return types
    .model('HierarchicalTrackSelectorWidget', {
      id: ElementId,
      type: types.literal('HierarchicalTrackSelectorWidget'),
      collapsed: types.map(types.boolean),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .volatile(() => ({
      selection: [] as AnyConfigurationModel[],
      filterText: '',
    }))
    .actions(self => ({
      setSelection(elt: AnyConfigurationModel[]) {
        self.selection = elt
      },
      addToSelection(elt: AnyConfigurationModel[]) {
        self.selection = dedupe([...self.selection, ...elt], e => e.trackId)
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
          if (viewType.displayTypes.some(d => d.name === display.type)) {
            return trackConf
          }
        }
        return undefined
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
        return [
          ...(refseq ? [refseq] : []),
          ...filterTracks(tracks, self, assemblyName),
        ]
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
        return relevantTracksForView(connection.tracks, self, assemblyName)
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
              ?.map(c => ({
                // @ts-expect-error
                id: getSnapshot(c).configuration,
                name: getConf(c, 'name'),
                children: this.connectionHierarchy(assemblyName, c),
                state: {
                  expanded: true,
                },
              }))
              .filter(f => f.children.length)) ||
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
        connection: { name: string; tracks: AnyConfigurationModel[] },
      ) {
        return generateHierarchy(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self as any,
          self.connectionTrackConfigurations(assemblyName, connection),
          self.collapsed,
          connection.name,
        )
      },
    }))
}

export type HierarchicalTrackSelectorStateModel = ReturnType<
  typeof stateTreeFactory
>
export type HierarchicalTrackSelectorModel =
  Instance<HierarchicalTrackSelectorStateModel>

export type { TreeNode }
