import { types, getSnapshot, Instance } from 'mobx-state-tree'
import { getConf, AnyConfigurationModel } from '@jbrowse/core/configuration'
import { dedupe, getSession, notEmpty } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { filterTracks } from './filterTracks'
import { generateHierarchy } from './generateHierarchy'

/**
 * #stateModel HierarchicalTrackSelectorWidget
 */
export default function stateTreeFactory(pluginManager: PluginManager) {
  return types
    .model('HierarchicalTrackSelectorWidget', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('HierarchicalTrackSelectorWidget'),
      /**
       * #property
       */
      collapsed: types.map(types.boolean),
      /**
       * #property
       */
      sort: types.maybe(types.boolean),
      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .volatile(() => ({
      selection: [] as AnyConfigurationModel[],
      filterText: '',
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHierarchicalSort(val: boolean) {
        self.sort = val
      },
      /**
       * #action
       */
      setSelection(elt: AnyConfigurationModel[]) {
        self.selection = elt
      },
      /**
       * #action
       */
      addToSelection(elt: AnyConfigurationModel[]) {
        self.selection = dedupe([...self.selection, ...elt], e => e.trackId)
      },
      /**
       * #action
       */
      removeFromSelection(elt: AnyConfigurationModel[]) {
        self.selection = self.selection.filter(f => !elt.includes(f))
      },
      /**
       * #action
       */
      clearSelection() {
        self.selection = []
      },
      /**
       * #action
       */
      setView(view: unknown) {
        self.view = view
      },
      /**
       * #action
       */
      toggleCategory(pathName: string) {
        self.collapsed.set(pathName, !self.collapsed.get(pathName))
      },
      /**
       * #action
       */
      clearFilterText() {
        self.filterText = ''
      },
      /**
       * #action
       */
      setFilterText(newText: string) {
        self.filterText = newText
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      getRefSeqTrackConf(
        assemblyName: string,
      ): AnyConfigurationModel | undefined {
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
      /**
       * #getter
       */
      get assemblyNames(): string[] {
        return self.view?.assemblyNames || []
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hierarchicalSort() {
        return self.sort ?? getConf(getSession(self), 'hierarchicalSort')
      },
      /**
       * #method
       * filter out tracks that don't match the current display types
       */
      connectionTrackConfigurations(connection: {
        tracks: AnyConfigurationModel[]
      }) {
        return !self.view ? [] : filterTracks(connection.tracks, self)
      },

      /**
       * #getter
       * filter out tracks that don't match the current assembly/display types
       */
      get trackConfigurations(): AnyConfigurationModel[] {
        return self.view
          ? [
              ...self.assemblyNames.map(a => self.getRefSeqTrackConf(a)),
              ...filterTracks(getSession(self).tracks, self),
            ].filter(notEmpty)
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hierarchy() {
        const hier = generateHierarchy(
          self as HierarchicalTrackSelectorModel,
          self.trackConfigurations,
          self.collapsed,
        )

        const session = getSession(self)
        const { connectionInstances } = session

        const conns =
          connectionInstances
            ?.map(c => ({
              // @ts-expect-error
              id: getSnapshot(c).configuration,
              name: getConf(c, 'name'),
              children: this.connectionHierarchy(c),
              state: {
                expanded: true,
              },
            }))
            .filter(f => f.children.length) || []

        return {
          name: 'Root',
          id: 'Root',
          children: [
            { name: 'Tracks', id: 'Tracks', children: hier },
            ...conns,
          ],
        }
      },

      /**
       * #method
       */
      connectionHierarchy(connection: {
        name: string
        tracks: AnyConfigurationModel[]
      }) {
        return generateHierarchy(
          self as HierarchicalTrackSelectorModel,
          self.connectionTrackConfigurations(connection),
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
