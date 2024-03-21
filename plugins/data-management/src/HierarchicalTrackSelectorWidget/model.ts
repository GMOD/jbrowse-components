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
  return typeof window !== 'undefined'
    ? [window.location.host, window.location.pathname].join('-')
    : 'empty'
}

// for settings that are not config dependent
function postF() {
  return typeof window !== 'undefined'
    ? [
        postNoConfigF(),
        new URLSearchParams(window.location.search).get('config'),
      ].join('-')
    : 'empty'
}

const MAX_RECENTLY_USED = 10

/**
 * #stateModel HierarchicalTrackSelectorWidget
 */
export default function stateTreeFactory(pluginManager: PluginManager) {
  return types
    .model('HierarchicalTrackSelectorWidget', {
      /**
       * #property
       */
      collapsed: types.map(types.boolean),

      /**
       * #property
       */
      faceted: types.optional(facetedStateTreeF(), {}),

      /**
       * #property
       */
      id: ElementId,

      /**
       * #property
       */
      initialized: types.maybe(types.boolean),

      /**
       * #property
       */
      sortCategories: types.maybe(types.boolean),

      /**
       * #property
       */
      sortTrackNames: types.maybe(types.boolean),

      /**
       * #property
       */
      type: types.literal('HierarchicalTrackSelectorWidget'),

      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .volatile(() => ({
      favorites: [] as string[],
      favoritesCounter: 0,
      filterText: '',
      recentlyUsed: [] as string[],
      recentlyUsedCounter: 0,
      selection: [] as AnyConfigurationModel[],
    }))
    .views(self => ({
      /**
       * #getter
       */
      get favoritesSet() {
        return new Set(self.favorites)
      },

      /**
       * #getter
       */
      get recentlyUsedSet() {
        return new Set(self.recentlyUsed)
      },

      /**
       * #getter
       */
      get selectionSet() {
        return new Set(self.selection)
      },

      /**
       * #getter
       */
      get shownTrackIds() {
        return new Set<string>(
          self.view?.tracks?.map(
            (t: { configuration: { trackId: string } }) =>
              t.configuration.trackId,
          ),
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addToFavorites(trackId: string) {
        self.favoritesCounter += 1
        self.favorites = [...self.favorites, trackId]
      },

      /**
       * #action
       */
      addToRecentlyUsed(id: string) {
        if (!self.recentlyUsed.includes(id)) {
          self.recentlyUsedCounter = Math.min(
            self.recentlyUsedCounter + 1,
            MAX_RECENTLY_USED,
          )
          self.recentlyUsed =
            self.recentlyUsed.length >= MAX_RECENTLY_USED
              ? [...self.recentlyUsed.slice(1), id]
              : [...self.recentlyUsed, id]
        }
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
      clearFavorites() {
        self.favorites = []
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
      clearRecentlyUsed() {
        self.recentlyUsed = []
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
      expandAllCategories() {
        self.collapsed.clear()
      },

      /**
       * #action
       */
      removeFromFavorites(trackId: string) {
        self.favorites = self.favorites.filter(f => f !== trackId)
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
      setCategoryCollapsed(pathName: string, status: boolean) {
        self.collapsed.set(pathName, status)
      },

      /**
       * #action
       */
      setFavorites(str: string[]) {
        self.favorites = str
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
      setFilterText(newText: string) {
        self.filterText = newText
      },

      /**
       * #action
       */
      setRecentlyUsed(str: string[]) {
        self.recentlyUsed = str
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
      setSelection(elt: AnyConfigurationModel[]) {
        self.selection = elt
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
      setSortTrackNames(val: boolean) {
        self.sortTrackNames = val
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

      /**
       * #method
       */
      isFavorite(trackId: string) {
        return self.favoritesSet.has(trackId)
      },

      /**
       * #method
       */
      isRecentlyUsed(trackId: string) {
        return self.recentlyUsedSet.has(trackId)
      },

      /**
       * #method
       */
      isSelected(track: AnyConfigurationModel) {
        return self.selectionSet.has(track)
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
      get activeSortCategories() {
        return (
          self.sortCategories ??
          getConf(getSession(self), ['hierarchical', 'sort', 'categories'])
        )
      },

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
      get allTrackConfigurationTrackIdSet() {
        return new Map(this.allTrackConfigurations.map(t => [t.trackId, t]))
      },

      /**
       * #getter
       */
      get allTrackConfigurations() {
        const { connectionInstances = [] } = getSession(self)
        return [
          ...this.configAndSessionTrackConfigurations,
          ...connectionInstances?.flatMap(c => c.tracks),
        ]
      },

      /**
       * #getter
       * filter out tracks that don't match the current assembly/display types
       */
      get configAndSessionTrackConfigurations() {
        return [
          ...self.assemblyNames.map(a => self.getRefSeqTrackConf(a)),
          ...filterTracks(getSession(self).tracks, self),
        ].filter(notEmpty)
      },

      /**
       * #getter
       */
      get favoritesLocalStorageKey() {
        // this has a extra } at the end because that's how it was initially
        // released
        return `favoriteTracks-${postF()}}`
      },

      /**
       * #getter
       */
      get recentlyUsedLocalStorageKey() {
        return `recentlyUsedTracks-${[postF(), self.assemblyNames.join(',')]
          .filter(f => !!f)
          .join('-')}`
      },
    }))
    .views(self => ({
      /**
       * #getter
       * filters out tracks that are not in the favorites group
       */
      get favoriteTracks() {
        return self.favorites
          .filter(t => self.allTrackConfigurationTrackIdSet.has(t))
          .map(t => self.allTrackConfigurationTrackIdSet.get(t)!)
      },

      /**
       * #getter
       * filters out tracks that are not in the recently used group
       */
      get recentlyUsedTracks() {
        return self.recentlyUsed
          .filter(t => self.allTrackConfigurationTrackIdSet.has(t))
          .map(t => self.allTrackConfigurationTrackIdSet.get(t)!)
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
            menuItems: [],
            noCategories: false,
            tracks: self.configAndSessionTrackConfigurations,
          },
          ...connectionInstances.flatMap(c => ({
            group: getConf(c, 'name'),
            menuItems: [],
            noCategories: false,
            tracks: c.tracks,
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
          children: self.allTracks.map(s => ({
            children: generateHierarchy({
              extra: s.group,
              model: self,
              noCategories: s.noCategories,
              trackConfs: s.tracks,
            }),
            id: s.group,
            isOpenByDefault: !self.collapsed.get(s.group),
            menuItems: s.menuItems,
            name: s.group,
            type: 'category' as const,
          })),
          id: 'Root',
          isOpenByDefault: true,
          name: 'Root',
          type: 'category' as const,
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
        // this should be the first autorun to properly initialize
        addDisposer(
          self,
          autorun(() => {
            self.setRecentlyUsed(
              JSON.parse(
                localStorageGetItem(self.recentlyUsedLocalStorageKey) || '[]',
              ),
            )
            self.setFavorites(
              JSON.parse(
                localStorageGetItem(self.favoritesLocalStorageKey) || '[]',
              ),
            )
          }),
        )
        // this should be the second autorun
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem(
              self.favoritesLocalStorageKey,
              JSON.stringify(self.favorites),
            )
            localStorageSetItem(
              self.recentlyUsedLocalStorageKey,
              JSON.stringify(self.recentlyUsed),
            )
          }),
        )
      },
    }))
}

export type HierarchicalTrackSelectorStateModel = ReturnType<
  typeof stateTreeFactory
>
export type HierarchicalTrackSelectorModel =
  Instance<HierarchicalTrackSelectorStateModel>
