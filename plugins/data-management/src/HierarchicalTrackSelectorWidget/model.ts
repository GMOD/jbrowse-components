import { types, getSnapshot, Instance } from 'mobx-state-tree'
import {
  getConf,
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  AbstractSessionModel,
  dedupe,
  getSession,
  getEnv,
  notEmpty,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import PluginManager from '@jbrowse/core/PluginManager'

function hasAnyOverlap<T>(a1: T[] = [], a2: T[] = []) {
  // shortcut case is that arrays are single entries, and are equal
  // long case is that we use a set
  if (a1[0] === a2[0]) {
    return true
  } else {
    const s1 = new Set(a1)
    return a2.some(a => s1.has(a))
  }
}

export function matches(
  query: string,
  conf: AnyConfigurationModel,
  session: AbstractSessionModel,
) {
  const categories = readConfObject(conf, 'category') as string[] | undefined
  const queryLower = query.toLowerCase()
  return (
    getTrackName(conf, session).toLowerCase().includes(queryLower) ||
    !!categories?.filter(c => c.toLowerCase().includes(queryLower)).length
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
  self: {
    view: { type: string; trackSelectorAnyOverlap?: boolean }
    assemblyNames: string[]
  },
) {
  const { assemblyManager } = getSession(self)
  const { pluginManager } = getEnv(self)
  const { view } = self
  const { trackSelectorAnyOverlap } = view
  const trackListAssemblies = self.assemblyNames
    .map(a => assemblyManager.get(a))
    .filter(notEmpty)

  return tracks
    .filter(c => {
      const trackAssemblyNames = readConfObject(c, 'assemblyNames') as string[]
      const trackAssemblies = new Set(
        trackAssemblyNames
          ?.map(name => assemblyManager.get(name))
          .filter(notEmpty) || [],
      )
      return trackSelectorAnyOverlap
        ? trackListAssemblies.some(a => trackAssemblies.has(a))
        : trackListAssemblies.every(a => trackAssemblies.has(a))
    })
    .filter(c => {
      const { displayTypes } = pluginManager.getViewType(view.type)
      const compatDisplays = displayTypes.map(d => d.name)
      const trackDisplays = c.displays.map((d: { type: string }) => d.type)
      return hasAnyOverlap(compatDisplays, trackDisplays)
    })
}

export function generateHierarchy(
  model: HierarchicalTrackSelectorModel,
  trackConfigurations: AnyConfigurationModel[],
  collapsed: { get: (arg: string) => boolean | undefined },
  extra?: string,
) {
  const hierarchy = { children: [] as TreeNode[] } as TreeNode
  const { filterText, view } = model
  const session = getSession(model)

  trackConfigurations
    .filter(conf => matches(filterText, conf, session))
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
        const id = extra + '-' + categories.slice(0, i + 1).join(',')
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
          name: getTrackName(conf, session),
          conf,
          checked: tracks.some(f => f.configuration === conf),
          children: [],
        },
      )
    })

  return hierarchy.children
}

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
        return !self.view
          ? ([] as AnyConfigurationModel[])
          : [
              ...self.assemblyNames.map(a => self.getRefSeqTrackConf(a)),
              ...filterTracks(getSession(self).tracks, self),
            ].filter(notEmpty)
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
