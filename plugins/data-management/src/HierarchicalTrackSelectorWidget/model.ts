import { getConf, readConfObject } from '@jbrowse/core/configuration'
import {
  dedupe,
  getSession,
  localStorageGetItem,
  localStorageSetItem,
  notEmpty,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

import { filterTracks } from './filterTracks.ts'
import { generateHierarchy } from './generateHierarchy.ts'
import {
  findSubCategories,
  findTopLevelCategories,
  getAllTrackNodes,
} from './util.ts'

import type { TreeNode } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const defaultItemHeight = 22
const categoryItemHeight = 40
const overscan = 20
const MAX_RECENTLY_USED = 10
const sortTrackNamesK = 'sortTrackNames'
const sortCategoriesK = 'sortCategories'

// for settings that are config dependent
function keyConfigPostFix() {
  return typeof window !== 'undefined'
    ? [
        window.location.pathname,
        new URLSearchParams(window.location.search).get('config'),
      ]
        .filter(Boolean)
        .join('-')
    : 'empty'
}

export function getItemHeight(item: TreeNode, folderCategories: Set<string>) {
  if (item.type === 'category') {
    return folderCategories.has(item.id)
      ? defaultItemHeight
      : categoryItemHeight
  }
  return defaultItemHeight
}

function recentlyUsedK(assemblyNames: string[]) {
  return ['recentlyUsedTracks', keyConfigPostFix(), assemblyNames.join(',')]
    .filter(Boolean)
    .join('-')
}

// this has a extra } at the end because that's how it was initially
// released
function favoritesK() {
  return `favoriteTracks-${keyConfigPostFix()}}`
}

function folderCategoriesK(assemblyNames: string[], viewType: string) {
  return [
    'folderCategories',
    keyConfigPostFix(),
    assemblyNames.join(','),
    viewType,
  ].join('-')
}

function collapsedK(assemblyNames: string[], viewType: string) {
  return [
    'collapsedCategories',
    keyConfigPostFix(),
    assemblyNames.join(','),
    viewType,
  ].join('-')
}

function localStorageGetJSON<T>(key: string, defaultValue: T) {
  const val = localStorageGetItem(key)
  return val ? (JSON.parse(val) as T) : defaultValue
}

function localStorageSetJSON(key: string, val: unknown) {
  if (val !== undefined && val !== null) {
    localStorageSetItem(key, JSON.stringify(val))
  }
}

function sortedTreeChildren(
  items: TreeNode[],
  folderCategories: { has(key: string): boolean },
) {
  const tracks: TreeNode[] = []
  const folders: TreeNode[] = []
  const categories: TreeNode[] = []
  for (const item of items) {
    if (item.type === 'track') {
      tracks.push(item)
    } else if (folderCategories.has(item.id)) {
      folders.push(item)
    } else {
      categories.push(item)
    }
  }
  return [...tracks, ...folders, ...categories]
}

// Binary search: returns the index of the last item whose offset <= `offset`.
function findIndexAtOffset(offsets: number[], offset: number) {
  let lo = 0
  let hi = offsets.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (offsets[mid]! <= offset) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return Math.max(0, lo - 1)
}

function flattenTree(
  items: TreeNode[],
  folderCategories: { has(key: string): boolean },
  collapsed: { get(key: string): boolean | undefined },
  result: TreeNode[] = [],
) {
  for (const item of sortedTreeChildren(items, folderCategories)) {
    result.push(item)
    if (
      item.children.length > 0 &&
      !collapsed.get(item.id) &&
      !(item.type === 'category' && folderCategories.has(item.id))
    ) {
      flattenTree(item.children, folderCategories, collapsed, result)
    }
  }
  return result
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
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
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
      sortTrackNames: localStorageGetJSON<boolean | undefined>(
        sortTrackNamesK,
        undefined,
      ),
      /**
       * #volatile
       */
      sortCategories: localStorageGetJSON<boolean | undefined>(
        sortCategoriesK,
        undefined,
      ),
      /**
       * #volatile
       */
      collapsed: observable.map<string, boolean>(),
      /**
       * #volatile
       */
      folderCategories: observable.set<string>(),
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
        return self.view?.assemblyNames ?? []
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
        if (!self.favoritesSet.has(trackId)) {
          self.favoritesCounter += 1
          self.favorites = [...self.favorites, trackId]
        }
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
        self.favoritesCounter = 0
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
      setFavoritesCounter(val: number) {
        self.favoritesCounter = val
      },
      /**
       * #action
       */
      addToRecentlyUsed(id: string) {
        if (!self.recentlyUsedSet.has(id)) {
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
        self.recentlyUsedCounter = 0
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
      toggleFolderCategory(categoryId: string) {
        if (self.folderCategories.has(categoryId)) {
          self.folderCategories.delete(categoryId)
        } else {
          self.folderCategories.add(categoryId)
        }
      },
      /**
       * #action
       */
      setFolderCategories(ids: string[]) {
        self.folderCategories.replace(ids)
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
      getRefSeqTrackConf(
        assemblyName: string,
      ): AnyConfigurationModel | undefined {
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        const trackConf = assembly?.configuration.sequence
        const viewType = pluginManager.getViewType(self.view.type)
        const viewDisplayNames = new Set(viewType.displayTypes.map(d => d.name))
        const matches = trackConf?.displays.some((display: { type: string }) =>
          viewDisplayNames.has(display.type),
        )
        return matches ? trackConf : undefined
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
      get allTrackConfigurationMap() {
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
          .map(t => self.allTrackConfigurationMap.get(t))
          .filter(notEmpty)
      },

      /**
       * #getter
       * filters out tracks that are not in the recently used group
       */
      get recentlyUsedTracks() {
        return self.recentlyUsed
          .map(t => self.allTrackConfigurationMap.get(t))
          .filter(notEmpty)
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
          },
          ...connectionInstances.map(c => ({
            group: getConf(c, 'name'),
            tracks: filterTracks(c.tracks, self),
            noCategories: false,
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
          type: 'category' as const,
          children: self.allTracks.map(s => ({
            name: s.group,
            id: s.group,
            type: 'category' as const,
            nestingLevel: 0,
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
    .views(self => ({
      get flattenedItems() {
        return flattenTree(
          self.hierarchy.children,
          self.folderCategories,
          self.collapsed,
        )
      },
      get flattenedItemOffsets() {
        const items = this.flattenedItems
        const offsets: number[] = []
        let cumulativeHeight = 0
        for (const item of items) {
          offsets.push(cumulativeHeight)
          cumulativeHeight += getItemHeight(item, self.folderCategories)
        }
        return { cumulativeHeight, offsets }
      },
    }))
    .views(self => ({
      itemOffsets(height: number, scrollTop: number) {
        const { flattenedItemOffsets } = self
        const { cumulativeHeight, offsets } = flattenedItemOffsets

        if (offsets.length === 0) {
          return { startIndex: 0, endIndex: -1, totalHeight: 0 }
        }

        const start = Math.max(
          0,
          findIndexAtOffset(offsets, scrollTop) - overscan,
        )
        const end = Math.min(
          offsets.length - 1,
          findIndexAtOffset(offsets, scrollTop + height) + overscan,
        )

        return {
          startIndex: start,
          endIndex: end,
          totalHeight: cumulativeHeight,
        }
      },
      get folderCategoryStats() {
        const stats = new Map<string, { active: number; total: number }>()
        const { shownTrackIds } = self
        for (const item of self.flattenedItems) {
          if (item.type === 'category' && self.folderCategories.has(item.id)) {
            const trackNodes = getAllTrackNodes(item)
            let active = 0
            for (const n of trackNodes) {
              if (shownTrackIds.has(n.trackId)) {
                active++
              }
            }
            stats.set(item.id, { active, total: trackNodes.length })
          }
        }
        return stats
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      collapseSubCategories() {
        for (const path of findSubCategories(self.hierarchy.children)) {
          self.setCategoryCollapsed(path, true)
        }
      },
      /**
       * #action
       */
      collapseTopLevelCategories() {
        for (const trackGroups of self.hierarchy.children) {
          for (const path of findTopLevelCategories(trackGroups.children)) {
            self.setCategoryCollapsed(path, true)
          }
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
        // Ordering matters: this load autorun must register before the persist
        // autorun below. Both run once immediately on registration; if persist
        // ran first it would write the model's empty defaults to localStorage,
        // clobbering saved settings before this autorun could load them.
        addDisposer(
          self,
          autorun(
            function trackSelectorInitAutorun() {
              const { assemblyNames, view } = self
              self.setRecentlyUsed(
                localStorageGetJSON<string[]>(recentlyUsedK(assemblyNames), []),
              )
              if (view) {
                const lc = localStorageGetJSON<[string, boolean][] | undefined>(
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

                const stc = localStorageGetJSON<string[] | undefined>(
                  folderCategoriesK(assemblyNames, view.type),
                  undefined,
                )
                if (stc) {
                  self.setFolderCategories(stc)
                } else {
                  for (const elt of getConf(session, [
                    'hierarchical',
                    'defaultFolderCategories',
                  ])) {
                    self.toggleFolderCategory(`Tracks-${elt}`)
                  }
                }
              }
            },
            { name: 'TrackSelectorInit' },
          ),
        )
        // persist autorun: must stay second (see ordering note above)
        addDisposer(
          self,
          autorun(
            function trackSelectorLocalStorageAutorun() {
              const {
                sortTrackNames,
                sortCategories,
                favorites,
                recentlyUsed,
                assemblyNames,
                collapsed,
                folderCategories,
                view,
              } = self
              localStorageSetJSON(recentlyUsedK(assemblyNames), recentlyUsed)
              localStorageSetJSON(favoritesK(), favorites)
              localStorageSetJSON(sortTrackNamesK, sortTrackNames)
              localStorageSetJSON(sortCategoriesK, sortCategories)
              if (view) {
                localStorageSetJSON(
                  collapsedK(assemblyNames, view.type),
                  collapsed,
                )
                localStorageSetJSON(
                  folderCategoriesK(assemblyNames, view.type),
                  [...folderCategories],
                )
              }
            },
            { name: 'TrackSelectorLocalStorage' },
          ),
        )
      },
    }))
}

export type HierarchicalTrackSelectorStateModel = ReturnType<
  typeof stateTreeFactory
>
export type HierarchicalTrackSelectorModel =
  Instance<HierarchicalTrackSelectorStateModel>
