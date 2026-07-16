import { getConf, readConfObject } from '@jbrowse/core/configuration'
import {
  dedupe,
  getSession,
  localStorageGetJSON,
  localStorageSetJSON,
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
import { configScopedKey, keyConfigPostFix } from '../shared/configScopedKey.ts'

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

// single source of truth for how a node renders, so virtual-scroll offset math
// (getItemHeight) and the row component (TreeItem) can't drift apart. A folder
// category collapses to a track-height row; only an expandable (non-folder)
// category gets the taller accordion styling
export function getNodePresentation(
  item: TreeNode,
  folderCategories: { has(key: string): boolean },
) {
  const isCategory = item.type === 'category'
  const isFolder = isCategory && folderCategories.has(item.id)
  const useAccordionStyle = isCategory && !isFolder
  return {
    isCategory,
    isFolder,
    useAccordionStyle,
    height: useAccordionStyle ? categoryItemHeight : defaultItemHeight,
  }
}

export function getItemHeight(
  item: TreeNode,
  folderCategories: { has(key: string): boolean },
) {
  return getNodePresentation(item, folderCategories).height
}

function recentlyUsedK(assemblyNames: string[]) {
  return configScopedKey('recentlyUsedTracks', assemblyNames)
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

// top-level hierarchy category id for a connection; expanding it lazily loads
// the connection (see toggleCategory)
function connectionCategoryId(connectionId: string) {
  return `connection-${connectionId}`
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

// a category is collapsed if the user explicitly toggled it, else by its
// defaultCollapsed (used for dormant connection categories)
export function isNodeCollapsed(
  item: TreeNode,
  collapsed: { get(key: string): boolean | undefined },
) {
  const explicit = collapsed.get(item.id)
  const byDefault = item.type === 'category' ? item.defaultCollapsed : undefined
  return explicit ?? byDefault ?? false
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
      !isNodeCollapsed(item, collapsed) &&
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
        if (self.favoritesSet.has(trackId)) {
          // don't touch favoritesCounter: it tracks additions unseen since the
          // dropdown was last opened, so removing an already-seen favorite must
          // not decrement it (that would under-count genuinely new additions)
          self.favorites = self.favorites.filter(f => f !== trackId)
        }
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
        const isNew = !self.recentlyUsedSet.has(id)
        // re-using an existing track moves it to the most-recent (end) slot;
        // only a genuinely new track bumps the unseen-since-opened badge counter
        const next = [...self.recentlyUsed.filter(f => f !== id), id]
        self.recentlyUsed = next.slice(-MAX_RECENTLY_USED)
        if (isNew) {
          self.recentlyUsedCounter = Math.min(
            self.recentlyUsedCounter + 1,
            MAX_RECENTLY_USED,
          )
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
        const session = getSession(self)
        const conn = session.connections.find(
          c => connectionCategoryId(c.connectionId) === pathName,
        )
        const isLive = conn
          ? (session.connectionInstances ?? []).some(
              c => c.connectionId === conn.connectionId,
            )
          : false
        // account for defaultCollapsed (dormant connections) so the first click
        // on one expands (and loads) it rather than toggling a phantom state
        const wasCollapsed =
          self.collapsed.get(pathName) ?? (conn ? !isLive : false)
        if (conn && wasCollapsed) {
          // expanding a connection = load it (no separate "turn on" step). Clear
          // any explicit collapse so the category follows liveness via
          // defaultCollapsed and never persists as expanded-but-unloaded
          self.collapsed.delete(pathName)
          session.hydrateConnection?.(conn.connectionId)
        } else {
          self.collapsed.set(pathName, !wasCollapsed)
        }
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
        const { view } = self
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        const trackConf = assembly?.configuration.sequence
        if (!view) {
          return undefined
        }
        const viewType = pluginManager.getViewType(view.type)
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
       * unfiltered map of every track (incl. connection tracks for other
       * assemblies/view types); used by the faceted selector
       */
      get allTrackConfigurationMap() {
        return new Map(this.allTrackConfigurations.map(t => [t.trackId, t]))
      },

      /**
       * #getter
       * map restricted to tracks the current view can display; connection
       * tracks go through the same filterTracks() pass as the tree so favorites
       * and recently-used don't surface tracks the view can't show
       */
      get displayableTrackConfigurationMap() {
        const { connectionInstances = [] } = getSession(self)
        return new Map(
          [
            ...this.configAndSessionTrackConfigurations,
            ...connectionInstances.flatMap(c => filterTracks(c.tracks, self)),
          ].map(t => [t.trackId, t]),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * filters out tracks that are not in the favorites group
       */
      get favoriteTracks() {
        return self.favorites
          .map(t => self.displayableTrackConfigurationMap.get(t))
          .filter(notEmpty)
      },

      /**
       * #getter
       * filters out tracks that are not in the recently used group
       */
      get recentlyUsedTracks() {
        return self.recentlyUsed
          .map(t => self.displayableTrackConfigurationMap.get(t))
          .filter(notEmpty)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get allTracks() {
        const session = getSession(self)
        const { connectionInstances = [], connections } = session
        const liveByConnectionId = new Map(
          connectionInstances.map(c => [c.connectionId, c]),
        )
        // one category per connection *config* (not just live instances), so a
        // connection shows in the tree before it's loaded; expanding it hydrates
        // the connection (see toggleCategory). Tracks are empty until then.
        return [
          {
            group: 'Tracks',
            id: 'Tracks',
            tracks: self.configAndSessionTrackConfigurations,
            noCategories: false,
            defaultCollapsed: false,
            loading: false,
          },
          ...connections.map(conf => {
            const live = liveByConnectionId.get(conf.connectionId)
            return {
              group: readConfObject(conf, 'name') as string,
              id: connectionCategoryId(conf.connectionId),
              tracks: live ? filterTracks(live.tracks, self) : [],
              noCategories: false,
              // dormant connections collapse by default so expanding loads them;
              // a loaded one shows its tracks
              defaultCollapsed: !live,
              // show a spinner while the connection is fetching. A failed connect
              // breaks the instance (no longer live), so this clears too
              loading: live?.loading ?? false,
            }
          }),
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
            id: s.id,
            type: 'category' as const,
            nestingLevel: 0,
            defaultCollapsed: s.defaultCollapsed,
            loading: s.loading,
            children: generateHierarchy({
              model: self,
              trackConfs: s.tracks,
              extra: s.id,
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
        const { offsets } = self.flattenedItemOffsets

        if (offsets.length === 0) {
          return { startIndex: 0, endIndex: -1 }
        }

        const start = Math.max(
          0,
          findIndexAtOffset(offsets, scrollTop) - overscan,
        )
        const end = Math.min(
          offsets.length - 1,
          findIndexAtOffset(offsets, scrollTop + height) + overscan,
        )

        return { startIndex: start, endIndex: end }
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
    .actions(self => {
      // collapsed/folderCategories/recentlyUsed keys are scoped to the assembly
      // (+ view type), which isn't known until the view resolves, so they load
      // lazily. `loadedScope` = the scope now in the model; persist writes only
      // for that scope, so load/persist order never matters and an assembly
      // switch can't write the old scope's state under the new key.
      let loadedScope: string | undefined

      function scopeKey(
        assemblyNames: string[],
        view: { type: string } | undefined,
      ) {
        return view ? `${assemblyNames.join(',')}|${view.type}` : ''
      }

      // apply saved collapse state, or seed it from the hierarchical config
      // defaults when nothing is persisted yet
      function loadCollapsed(assemblyNames: string[], viewType: string) {
        const lc = localStorageGetJSON<[string, boolean][] | undefined>(
          collapsedK(assemblyNames, viewType),
          undefined,
        )
        if (lc) {
          self.setCollapsedCategories(lc)
        } else {
          const session = getSession(self)
          const r = ['hierarchical', 'defaultCollapsed']
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
        }
      }

      function loadFolderCategories(assemblyNames: string[], viewType: string) {
        const stc = localStorageGetJSON<string[] | undefined>(
          folderCategoriesK(assemblyNames, viewType),
          undefined,
        )
        if (stc) {
          self.setFolderCategories(stc)
        } else {
          self.setFolderCategories(
            getConf(getSession(self), [
              'hierarchical',
              'defaultFolderCategories',
            ]).map((elt: string) => `Tracks-${elt}`),
          )
        }
      }

      function loadFromLocalStorage() {
        const { assemblyNames, view } = self
        self.setRecentlyUsed(
          localStorageGetJSON<string[]>(recentlyUsedK(assemblyNames), []),
        )
        if (view) {
          loadCollapsed(assemblyNames, view.type)
          loadFolderCategories(assemblyNames, view.type)
        }
        loadedScope = scopeKey(assemblyNames, view)
      }

      function persistToLocalStorage() {
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
        // skip until load has populated this scope (guards against writing empty
        // defaults or a previous scope's state)
        if (scopeKey(assemblyNames, view) === loadedScope) {
          localStorageSetJSON(recentlyUsedK(assemblyNames), recentlyUsed)
          localStorageSetJSON(favoritesK(), favorites)
          localStorageSetJSON(sortTrackNamesK, sortTrackNames)
          localStorageSetJSON(sortCategoriesK, sortCategories)
          if (view) {
            localStorageSetJSON(collapsedK(assemblyNames, view.type), collapsed)
            localStorageSetJSON(folderCategoriesK(assemblyNames, view.type), [
              ...folderCategories,
            ])
          }
        }
      }

      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(loadFromLocalStorage, { name: 'TrackSelectorInit' }),
          )
          addDisposer(
            self,
            autorun(persistToLocalStorage, { name: 'TrackSelectorPersist' }),
          )
        },
      }
    })
}

export type HierarchicalTrackSelectorStateModel = ReturnType<
  typeof stateTreeFactory
>
export type HierarchicalTrackSelectorModel =
  Instance<HierarchicalTrackSelectorStateModel>
