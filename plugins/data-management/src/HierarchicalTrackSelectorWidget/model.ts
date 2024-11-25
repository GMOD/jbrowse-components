import { getConf, readConfObject } from '@jbrowse/core/configuration'
import {
  dedupe,
  getSession,
  localStorageGetItem,
  localStorageSetItem,
  notEmpty,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { autorun, observable } from 'mobx'
import { types, addDisposer } from 'mobx-state-tree'

// locals
import { facetedStateTreeF } from './facetedModel'
import { filterTracks } from './filterTracks'
import { generateHierarchy } from './generateHierarchy'
import { findSubCategories, findTopLevelCategories } from './util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Instance } from 'mobx-state-tree'

type MaybeAnyConfigurationModel = AnyConfigurationModel | undefined

type MaybeBoolean = boolean | undefined

type MaybeCollapsedKeys = [string, boolean][] | undefined

// for settings that are config dependent
function keyConfigPostFix() {
  return typeof window !== 'undefined'
    ? [
        window.location.pathname,
        new URLSearchParams(window.location.search).get('config'),
      ]
        .filter(f => !!f)
        .join('-')
    : 'empty'
}

function recentlyUsedK(assemblyNames: string[]) {
  return ['recentlyUsedTracks', keyConfigPostFix(), assemblyNames.join(',')]
    .filter(f => !!f)
    .join('-')
}

// this has a extra } at the end because that's how it was initially
// released
function favoritesK() {
  return `favoriteTracks-${keyConfigPostFix()}}`
}

function collapsedK(assemblyNames: string[], viewType: string) {
  return [
    'collapsedCategories',
    keyConfigPostFix(),
    assemblyNames.join(','),
    viewType,
  ].join('-')
}

function sortTrackNamesK() {
  return 'sortTrackNames'
}

function sortCategoriesK() {
  return 'sortCategories'
}

function localStorageGetJSON<T>(key: string, defaultValue: T) {
  const val = localStorageGetItem(key)
  return val !== undefined && val !== null && val
    ? (JSON.parse(val) as T)
    : defaultValue
}

function localStorageSetJSON(key: string, val: unknown) {
  if (val !== undefined && val !== null) {
    localStorageSetItem(key, JSON.stringify(val))
  }
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
      id: ElementId,
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
      /**
       * #property
       */
      faceted: types.optional(facetedStateTreeF(), {}),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      favorites: localStorageGetJSON<string[]>(favoritesK(), []),
      /**
       * #volatile
       */
      recentlyUsed: [] as string[],
      /**
       * #volatile
       */
      selection: [] as AnyConfigurationModel[],
      /**
       * #volatile
       */
      sortTrackNames: localStorageGetJSON<MaybeBoolean>(
        sortTrackNamesK(),
        undefined,
      ),
      /**
       * #volatile
       */
      sortCategories: localStorageGetJSON<MaybeBoolean>(
        sortCategoriesK(),
        undefined,
      ),
      /**
       * #volatile
       */
      collapsed: observable.map<string, boolean>(),
      /**
       * #volatile
       */
      filterText: '',
      /**
       * #volatile
       */
      recentlyUsedCounter: 0,
      /**
       * #volatile
       */
      favoritesCounter: 0,
    }))
    .views(self => ({
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
      /**
       * #getter
       */
      get selectionSet() {
        return new Set(self.selection)
      },
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
      get assemblyNames(): string[] {
        return self.view?.assemblyNames || []
      },
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
      addToFavorites(trackId: string) {
        self.favoritesCounter += 1
        self.favorites = [...self.favorites, trackId]
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
      clearFavorites() {
        self.favorites = []
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
      setRecentlyUsed(str: string[]) {
        self.recentlyUsed = str
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
      clearRecentlyUsed() {
        self.recentlyUsed = []
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
      setCollapsedCategories(str: [string, boolean][]) {
        self.collapsed.replace(str)
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
      isSelected(track: AnyConfigurationModel) {
        return self.selectionSet.has(track)
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
      getRefSeqTrackConf(assemblyName: string): MaybeAnyConfigurationModel {
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        const trackConf = assembly?.configuration.sequence
        const viewType = pluginManager.getViewType(self.view.type)!
        if (trackConf) {
          for (const display of trackConf.displays) {
            if (viewType.displayTypes.some(d => d.name === display.type)) {
              return trackConf
            }
          }
        }
        return undefined
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
      get allTrackConfigurations() {
        const { connectionInstances = [] } = getSession(self)
        return [
          ...this.configAndSessionTrackConfigurations,
          ...connectionInstances.flatMap(c => c.tracks),
        ]
      },

      /**
       * #getter
       */
      get allTrackConfigurationTrackIdSet() {
        return new Map(this.allTrackConfigurations.map(t => [t.trackId, t]))
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
            tracks: self.configAndSessionTrackConfigurations,
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
            const { assemblyNames, view } = self
            self.setRecentlyUsed(
              localStorageGetJSON<string[]>(recentlyUsedK(assemblyNames), []),
            )
            if (view) {
              const lc = localStorageGetJSON<MaybeCollapsedKeys>(
                collapsedK(assemblyNames, view.type),
                undefined,
              )
              const r = ['hierarchical', 'defaultCollapsed']
              const session = getSession(self)
              if (!lc) {
                self.expandAllCategories()
                if (getConf(session, [...r, 'topLevelCategories'])) {
                  self.collapseTopLevelCategories()
                }
                if (getConf(session, [...r, 'subCategories'])) {
                  self.collapseSubCategories()
                }
                for (const elt of getConf(session, [...r, 'categoryNames'])) {
                  self.setCategoryCollapsed(`Tracks-${elt}`, true)
                }
              } else {
                self.setCollapsedCategories(lc)
              }
            }
          }),
        )
        // this should be the second autorun
        addDisposer(
          self,
          autorun(() => {
            const {
              sortTrackNames,
              sortCategories,
              favorites,
              recentlyUsed,
              assemblyNames,
              collapsed,
              view,
            } = self
            localStorageSetJSON(recentlyUsedK(assemblyNames), recentlyUsed)
            localStorageSetJSON(favoritesK(), favorites)
            localStorageSetJSON(sortTrackNamesK(), sortTrackNames)
            localStorageSetJSON(sortCategoriesK(), sortCategories)
            if (view) {
              localStorageSetJSON(
                collapsedK(assemblyNames, view.type),
                collapsed,
              )
            }
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
