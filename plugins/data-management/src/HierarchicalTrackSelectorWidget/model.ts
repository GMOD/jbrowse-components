import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'
import {
  getConf,
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  dedupe,
  getSession,
  localStorageGetItem,
  localStorageSetItem,
  notEmpty,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { filterTracks } from './filterTracks'
import { generateHierarchy } from './generateHierarchy'
import { findSubCategories, findTopLevelCategories } from './util'
import { facetedStateTreeF } from './facetedModel'

type MaybeAnyConfigurationModel = AnyConfigurationModel | undefined

// for settings that are config dependent
function postNoConfigF() {
  return typeof window !== undefined
    ? [window.location.host, window.location.pathname].join('-')
    : 'empty'
}

// for settings that are not config dependent
function postF() {
  return typeof window !== undefined
    ? [
        postNoConfigF(),
        new URLSearchParams(window.location.search).get('config'),
      ].join('-')
    : 'empty'
}

const lsKeyFavoritesF = () => `favoriteTracks-${postF()}}`
const lsKeyRecentlyUsedF = () => `recentlyUsedTracks-${postF()}}`

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
      initialized: types.maybe(types.boolean),
      /**
       * #property
       */
      collapsed: types.map(types.boolean),
      /**
       * #property
       */
      sortTrackNames: types.maybe(types.boolean),
      /**
       * #property
       */
      sortCategories: types.maybe(types.boolean),
      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      /**
       * #property
       * this is removed in postProcessSnapshot, so is generally only loaded
       * from localstorage
       */
      favorites: types.optional(types.array(types.string), () =>
        JSON.parse(localStorageGetItem(lsKeyFavoritesF()) || '[]'),
      ),
      /**
       * #property
       * this is removed in postProcessSnapshot, so is generally only loaded
       * from localstorage
       */
      recentlyUsed: types.optional(types.array(types.string), () =>
        JSON.parse(localStorageGetItem(lsKeyRecentlyUsedF()) || '[]'),
      ),

     /**
       * #property
       */
      faceted: types.optional(facetedStateTreeF(), {}),
    })
    .volatile(() => ({
      selection: [] as AnyConfigurationModel[],
      filterText: '',
      recentlyUsedCounter: 0,
      favoritesCounter: 0,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSortTrackNames(val: boolean) {
        self.sortTrackNames = val
      },
      /**
       * #action
       */
      setSortCategories(val: boolean) {
        self.sortCategories = val
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
        const s = new Set(elt)
        self.selection = self.selection.filter(f => !s.has(f))
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
      isFavorite(trackId: string) {
        return self.favorites.includes(trackId)
      },
      /**
       * #action
       */
      addToFavorites(trackId: string) {
        self.favoritesCounter += 1
        self.favorites.push(trackId)
      },
      /**
       * #action
       */
      removeFromFavorites(trackId: string) {
        self.favorites.remove(trackId)
      },
      /**
       * #action
       */
      clearFavorites() {
        self.favorites.clear()
      },
      /**
       * #action
       */
      isRecentlyUsed(trackId: string) {
        return self.recentlyUsed.includes(trackId)
      },
      /**
       * #action
       */
      setRecentlyUsedCounter(val: number) {
        self.recentlyUsedCounter = val
      },
      /**
       * #action
       */
      setFavoritesCounter(val: number) {
        self.favoritesCounter = val
      },
      /**
       * #action
       */
      addToRecentlyUsed(id: string) {
        self.recentlyUsedCounter += 1
        if (!self.recentlyUsed.includes(id)) {
          if (self.recentlyUsed.length >= 10) {
            self.recentlyUsed.shift()
          }
          self.recentlyUsed.push(id)
        }
      },

      /**
       * #action
       */
      clearRecentlyUsed() {
        self.recentlyUsed.clear()
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
      setCategoryCollapsed(pathName: string, status: boolean) {
        self.collapsed.set(pathName, status)
      },
      /**
       * #action
       */
      expandAllCategories() {
        self.collapsed.clear()
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
      getRefSeqTrackConf(assemblyName: string): MaybeAnyConfigurationModel {
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
      get activeSortTrackNames() {
        return (
          self.sortTrackNames ??
          getConf(getSession(self), ['hierarchical', 'sort', 'trackNames'])
        )
      },
      /**
       * #getter
       */
      get activeSortCategories() {
        return (
          self.sortCategories ??
          getConf(getSession(self), ['hierarchical', 'sort', 'categories'])
        )
      },
      /**
       * #method
       * filter out tracks that don't match the current display types
       */
      connectionTrackConfigurations(conn: { tracks: AnyConfigurationModel[] }) {
        return filterTracks(conn.tracks, self)
      },

      /**
       * #getter
       * filter out tracks that don't match the current assembly/display types
       */
      get trackConfigurations() {
        return [
          ...self.assemblyNames.map(a => self.getRefSeqTrackConf(a)),
          ...filterTracks(getSession(self).tracks, self),
        ].filter(notEmpty)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * filters out tracks that are not in the favorites group
       */
      get favoriteTracks() {
        const s = new Set(self.favorites)
        return self.trackConfigurations.filter(t => s.has(t.trackId))
      },

      /**
       * #getter
       * filters out tracks that are not in the recently used group
       */
      get recentlyUsedTracks() {
        const s = new Set(self.recentlyUsed)
        return self.trackConfigurations.filter(t => s.has(t.trackId))
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get allTracks() {
        const { connectionInstances = [] } = getSession(self)
        return [
          {
            group: 'Tracks',
            tracks: self.trackConfigurations,
            noCategories: false,
            menuItems: [],
          },
          ...connectionInstances.flatMap(c => ({
            group: getConf(c, 'name'),
            tracks: c.tracks,
            noCategories: false,
            menuItems: [],
          })),
        ]
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hierarchy() {
        return {
          name: 'Root',
          id: 'Root',
          isOpenByDefault: true,
          type: 'category' as const,
          children: self.allTracks.map(s => ({
            name: s.group,
            id: s.group,
            type: 'category' as const,
            isOpenByDefault: !self.collapsed.get(s.group),
            menuItems: s.menuItems,
            children: generateHierarchy({
              model: self,
              trackConfs: s.tracks,
              extra: s.group,
              noCategories: s.noCategories,
            }),
          })),
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      collapseSubCategories() {
        const paths = [] as string[]
        findSubCategories(self.hierarchy.children, paths)
        for (const path of paths) {
          self.setCategoryCollapsed(path, true)
        }
      },
      /**
       * #action
       */
      collapseTopLevelCategories() {
        const paths = [] as string[]
        for (const trackGroups of self.hierarchy.children) {
          if (trackGroups.children.length) {
            findTopLevelCategories(trackGroups.children, paths)
          }
        }
        for (const path of paths) {
          self.setCategoryCollapsed(path, true)
        }
      },
    }))
    .actions(self => ({
      afterCreate() {
        if (!self.initialized) {
          const session = getSession(self)
          if (
            getConf(session, [
              'hierarchical',
              'defaultCollapsed',
              'topLevelCategories',
            ])
          ) {
            self.collapseTopLevelCategories()
          }
          if (
            getConf(session, [
              'hierarchical',
              'defaultCollapsed',
              'subCategories',
            ])
          ) {
            self.collapseSubCategories()
          }
          for (const entry of getConf(session, [
            'hierarchical',
            'defaultCollapsed',
            'categoryNames',
          ])) {
            self.collapsed.set(entry, true)
          }
          self.initialized = true
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasAnySubcategories() {
        return self.allTracks.some(group =>
          group.tracks.some(t => readConfObject(t, 'category')?.length > 1),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem(
              lsKeyFavoritesF(),
              JSON.stringify(self.favorites),
            )
            localStorageSetItem(
              lsKeyRecentlyUsedF(),
              JSON.stringify(self.recentlyUsed),
            )
          }),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      const {
        favorites: _,
        recentlyUsed: __,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return rest
    })
}

export type HierarchicalTrackSelectorStateModel = ReturnType<
  typeof stateTreeFactory
>
export type HierarchicalTrackSelectorModel =
  Instance<HierarchicalTrackSelectorStateModel>
