import { getConf, readConfObject } from '@jbrowse/core/configuration'
import {
  getSession,
  isSessionWithSessionTracks,
  localStorageGetJSON,
  localStorageSetJSON,
  notEmpty,
} from '@jbrowse/core/util'
import {
  viewCanDisplayTrack,
  viewDisplayNames,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

import { configScopedKey, keyConfigPostFix } from '../shared/configScopedKey.ts'
import { normalizeSearchQuery } from '../shared/searchText.ts'
import { filterTracks } from './filterTracks.ts'
import { generateHierarchy } from './generateHierarchy.ts'
import { sortSources } from './sortUtils.ts'
import {
  categoryId,
  findSubCategories,
  findTopLevelCategories,
  getAllTrackNodes,
  trackNodeSourceFor,
} from './util.ts'

import type {
  CategoryMode,
  ResolvedCategoryMode,
  TreeNode,
  TreeRow,
  TreeTrackNode,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { TrackContainer } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const defaultItemHeight = 22
const categoryItemHeight = 40
const overscan = 20
const MAX_RECENTLY_USED = 10
const sortTrackNamesK = 'sortTrackNames'
const sortCategoriesK = 'sortCategories'

// the group holding the config's own tracks, as opposed to a connection's
const mainGroupId = 'Tracks'

interface CategoryModes {
  get(key: string): CategoryMode | undefined
}

function recentlyUsedK(assemblyNames: string[]) {
  return configScopedKey('recentlyUsedTracks', assemblyNames)
}

// this has a extra } at the end because that's how it was initially
// released
function favoritesK() {
  return `favoriteTracks-${keyConfigPostFix()}}`
}

function scopedK(name: string, assemblyNames: string[], viewType: string) {
  return [name, keyConfigPostFix(), assemblyNames.join(','), viewType].join('-')
}

// top-level hierarchy category id for a connection; expanding it lazily loads
// the connection (see toggleCategory)
function connectionCategoryId(connectionId: string) {
  return `connection-${connectionId}`
}

// A filter has to be able to reach a track inside a collapsed category or a
// folder, so an active query forces categories open, without disturbing the
// modes the user gets back when they clear the box. A category collapsed by
// default rather than by choice — a dormant connection, whose tracks aren't
// loaded — is exempt: clicking it is what loads it (see toggleCategory), and
// forcing it open would only draw an open arrow over an empty group
export function isFilterForcedOpen(item: TreeNode, filterActive: boolean) {
  return filterActive && !(item.type === 'category' && item.defaultCollapsed)
}

// A category is expanded unless the user put it in a mode, or it defaults
// collapsed (dormant connection categories)
function resolveCategoryMode(
  item: TreeNode,
  modes: CategoryModes,
  filterActive: boolean,
): ResolvedCategoryMode {
  return item.type === 'category' && !isFilterForcedOpen(item, filterActive)
    ? (modes.get(item.id) ?? (item.defaultCollapsed ? 'collapsed' : 'expanded'))
    : 'expanded'
}

// one level of the tree in draw order — tracks, then folders, then expandable
// categories — each item paired with the mode it resolved to, so the caller
// doesn't resolve it a second time
function sortedTreeChildren(
  items: TreeNode[],
  modes: CategoryModes,
  filterActive: boolean,
) {
  const tracks: { item: TreeNode; mode: ResolvedCategoryMode }[] = []
  const folders: typeof tracks = []
  const categories: typeof tracks = []
  for (const item of items) {
    const mode = resolveCategoryMode(item, modes, filterActive)
    if (item.type === 'track') {
      tracks.push({ item, mode })
    } else if (mode === 'folder') {
      folders.push({ item, mode })
    } else {
      categories.push({ item, mode })
    }
  }
  return [...tracks, ...folders, ...categories]
}

// The rendered rows, in order, each with the height and offset the virtual
// scroller places it at. One walk produces the layout and the per-row
// presentation together, so the offset math and the row component can't drift
// apart. A folder is a track-height row whose children are not walked; only an
// expandable (non-folder) category gets the taller accordion styling.
function buildRows(
  children: TreeNode[],
  modes: CategoryModes,
  filterActive: boolean,
) {
  const rows: TreeRow[] = []
  let top = 0
  function walk(items: TreeNode[]) {
    for (const { item, mode } of sortedTreeChildren(
      items,
      modes,
      filterActive,
    )) {
      const accordion = item.type === 'category' && mode !== 'folder'
      const height = accordion ? categoryItemHeight : defaultItemHeight
      rows.push({ item, mode, accordion, height, top })
      top += height
      if (mode === 'expanded' && item.children.length > 0) {
        walk(item.children)
      }
    }
  }
  walk(children)
  return rows
}

// Binary search: returns the index of the last row that starts at or before
// `offset`.
function findRowAtOffset(rows: TreeRow[], offset: number) {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (rows[mid]!.top <= offset) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return Math.max(0, lo - 1)
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

      /**
       * #property
       * Which of the view's track containers this selector writes into, by id.
       * Absent — the usual case — means the view itself. A view owning several
       * track lists (the synteny view, one per level band) names one here; the
       * container is resolved through `view.trackContainerFor` rather than
       * referenced directly, because it isn't a view and so isn't a legal
       * target for the `view` reference above.
       */
      trackContainerId: types.maybe(types.string),
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
       * the shopping cart, by trackId — like favorites, recentlyUsed and
       * shownTrackIds, and unlike the config objects it used to hold. A config
       * is not a stable identity: a non-admin's edit to an admin track resolves
       * through a fresh merged object (ADR-032), so a selection holding the old
       * one kept counting in the cart while the row it belonged to went back to
       * looking unselected. Read `selection` for the configs.
       */
      selectedTrackIds: [] as string[],
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
       * per-category rendering mode; absent means expanded. Collapsed and
       * folder are mutually exclusive by construction, so un-foldering a
       * category can't reveal a stale collapse underneath it
       */
      categoryMode: observable.map<string, CategoryMode>(),
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
       * The track list this selector shows and writes into: the view itself,
       * or one of its containers when `trackContainerId` names one.
       */
      get trackContainer(): TrackContainer | undefined {
        const { view, trackContainerId } = self
        return trackContainerId === undefined
          ? view
          : view?.trackContainerFor?.(trackContainerId)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get shownTrackIds() {
        return new Set<string>(
          self.trackContainer?.tracks.map(t => t.configuration.trackId),
        )
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
        return self.trackContainer?.assemblyNames ?? []
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
      setSelection(trackIds: string[]) {
        self.selectedTrackIds = [...new Set(trackIds)]
      },
      /**
       * #action
       */
      addToSelection(trackIds: string[]) {
        self.selectedTrackIds = [
          ...new Set([...self.selectedTrackIds, ...trackIds]),
        ]
      },
      /**
       * #action
       */
      removeFromSelection(trackIds: string[]) {
        const s = new Set(trackIds)
        self.selectedTrackIds = self.selectedTrackIds.filter(id => !s.has(id))
      },
      /**
       * #action
       */
      clearSelection() {
        self.selectedTrackIds = []
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
      setTrackContainerId(id: string | undefined) {
        self.trackContainerId = id
      },
      /**
       * #action
       */
      setCategoryMode(id: string, mode: CategoryMode | undefined) {
        if (mode) {
          self.categoryMode.set(id, mode)
        } else {
          self.categoryMode.delete(id)
        }
      },
      /**
       * #action
       */
      clearCategoryModes() {
        self.categoryMode.clear()
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
    .actions(self => ({
      /**
       * #action
       * the single gate on accordion state: a folder is a mode the user picked,
       * not an accordion that happens to be shut, so every collapse/expand —
       * one row, a bulk menu item, or "expand all" — passes it by
       */
      setCategoryCollapsed(id: string, collapsed: boolean) {
        if (self.categoryMode.get(id) !== 'folder') {
          self.setCategoryMode(id, collapsed ? 'collapsed' : undefined)
        }
      },
      /**
       * #action
       * folder and collapsed are the same slot, so leaving folder mode always
       * lands on an expanded category
       */
      setFolderCategory(id: string, isFolder: boolean) {
        self.setCategoryMode(id, isFolder ? 'folder' : undefined)
      },
      /**
       * #action
       */
      expandAllCategories() {
        for (const [id, mode] of self.categoryMode) {
          if (mode === 'collapsed') {
            self.categoryMode.delete(id)
          }
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      toggleCategory(id: string) {
        const session = getSession(self)
        const conn = session.connections.find(
          c => connectionCategoryId(c.connectionId) === id,
        )
        const isLive = conn
          ? (session.connectionInstances ?? []).some(
              c => c.connectionId === conn.connectionId,
            )
          : false
        const mode = self.categoryMode.get(id)
        // account for defaultCollapsed (dormant connections) so the first click
        // on one expands (and loads) it rather than toggling a phantom state
        const wasCollapsed = mode ? mode === 'collapsed' : !!conn && !isLive
        if (conn && wasCollapsed) {
          // expanding a connection = load it (no separate "turn on" step). Clear
          // any explicit collapse so the category follows liveness via
          // defaultCollapsed and never persists as expanded-but-unloaded
          self.setCategoryMode(id, undefined)
          session.hydrateConnection?.(conn.connectionId)
        } else {
          self.setCategoryCollapsed(id, !wasCollapsed)
        }
      },
    }))
    .views(self => ({
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
        if (!view) {
          return undefined
        }
        const { assemblyManager } = getSession(self)
        const trackConf = assemblyManager.get(assemblyName)?.configuration
          .sequence as AnyConfigurationModel | undefined
        // same display-compatibility question filterTracks asks of every other
        // track, so a view that can't draw a sequence doesn't list one
        return trackConf &&
          viewCanDisplayTrack(
            pluginManager,
            viewDisplayNames(pluginManager, view.type),
            trackConf.type,
          )
          ? trackConf
          : undefined
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
       * one group per connection *config* (not just live instances), so a
       * connection shows in the tree before it's loaded; expanding it hydrates
       * the connection (see toggleCategory). Tracks are empty until then.
       *
       * Each track is resolved to a TrackNodeSource and sorted here rather than
       * in generateHierarchy, so a filterText keystroke reads no configs and
       * re-sorts nothing (filtering preserves order)
       */
      get allTracks() {
        const session = getSession(self)
        const { connectionInstances = [], connections } = session
        const liveByConnectionId = new Map(
          connectionInstances.map(c => [c.connectionId, c]),
        )
        // a connection's tracks are never the session's own, so only the main
        // group can put a track under the session-tracks pseudo-category
        const { sessionTrackIds } = this
        const resolve = (
          tracks: AnyConfigurationModel[],
          sessionTracks = false,
        ) =>
          sortSources(
            tracks.map(t =>
              trackNodeSourceFor(t, {
                session,
                isSessionTrack: sessionTracks && sessionTrackIds.has(t.trackId),
              }),
            ),
            this.activeSortTrackNames,
            this.activeSortCategories,
          )
        return [
          {
            group: mainGroupId,
            id: mainGroupId,
            tracks: resolve(this.configAndSessionTrackConfigurations, true),
            defaultCollapsed: false,
            loading: false,
          },
          ...connections.map(conf => {
            const live = liveByConnectionId.get(conf.connectionId)
            return {
              group: readConfObject(conf, 'name') as string,
              id: connectionCategoryId(conf.connectionId),
              tracks: live ? resolve(filterTracks(live.tracks, self)) : [],
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

      /**
       * #getter
       * the normalized filter box contents; empty when nothing is being
       * searched for
       */
      get filterQuery() {
        return normalizeSearchQuery(self.filterText)
      },

      /**
       * #getter
       * a query is being searched for, which forces categories open
       * (isFilterForcedOpen)
       */
      get filterActive() {
        return this.filterQuery !== ''
      },

      /**
       * #getter
       * tracks matching filterText. An empty query matches everything, since
       * ''.includes is always true, so there is no unfiltered special case
       */
      get filteredTrackSet() {
        const query = this.filterQuery
        const result = new Set<AnyConfigurationModel>()
        for (const group of this.allTracks) {
          for (const source of group.tracks) {
            if (source.searchText.includes(query)) {
              result.add(source.conf)
            }
          }
        }
        return result
      },

      /**
       * #getter
       * a non-admin's added/copied tracks, which the tree groups under a
       * "Session tracks" category. Membership is the session's own list — the
       * source of truth — not a suffix baked into the trackId
       */
      get sessionTrackIds() {
        const session = getSession(self)
        return new Set(
          isSessionWithSessionTracks(session)
            ? session.sessionTracks.map(t => t.trackId)
            : [],
        )
      },

      /**
       * #getter
       * every track the current view can display, tree order. Derived from
       * allTracks so there is exactly one filterTracks() pass, shared with the
       * tree: the faceted selector, favorites and recently-used then can't
       * offer a track the view has no way to open. Connection tracks used to
       * reach the faceted selector unfiltered, which listed a connection's
       * other-assembly tracks next to the config's filtered ones
       */
      get allTrackConfigurations() {
        return this.allTracks.flatMap(g => g.tracks).map(s => s.conf)
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
       * The selected track configs, resolved from `selectedTrackIds` on read
       * exactly as favorites and recently-used are. That is the one gate for
       * every delete path (the cart's own "Delete tracks", a single track's
       * menu) — a track that has gone away no longer resolves, so nothing has
       * to clean up after it — and it is what keeps an edited track selected,
       * since the id outlives the config object an edit replaces.
       */
      get selection(): AnyConfigurationModel[] {
        return self.selectedTrackIds
          .map(t => self.allTrackConfigurationMap.get(t))
          .filter(notEmpty)
      },
      /**
       * #getter
       * the selected trackIds that still resolve to a track — `selection`'s
       * ids, so a row can ask whether it is selected without the config
       * identity comparison that used to answer it
       */
      get selectionSet() {
        return new Set(this.selection.map(t => t.trackId as string))
      },
      /**
       * #method
       */
      isSelected(trackId: string) {
        return this.selectionSet.has(trackId)
      },
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
       * a group is kept even when no track in it survives the filter, so an
       * empty connection still shows in the tree
       */
      get hierarchy() {
        const { filteredTrackSet } = self
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
              trackSources: s.tracks,
              filteredTrackSet,
              groupId: s.id,
            }),
          })),
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * every rendered row, in order, with its height and scroll offset
       */
      get rows() {
        return buildRows(
          self.hierarchy.children,
          self.categoryMode,
          self.filterActive,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get treeHeight() {
        const last = self.rows.at(-1)
        return last ? last.top + last.height : 0
      },
      /**
       * #method
       */
      visibleRange(height: number, scrollTop: number) {
        const { rows } = self
        return rows.length === 0
          ? { startIndex: 0, endIndex: -1 }
          : {
              startIndex: Math.max(
                0,
                findRowAtOffset(rows, scrollTop) - overscan,
              ),
              endIndex: Math.min(
                rows.length - 1,
                findRowAtOffset(rows, scrollTop + height) + overscan,
              ),
            }
      },
      // structure-only, so showing/hiding a track doesn't re-walk every folder
      // subtree; only folderCategoryStats' cheap counting pass re-runs
      get folderTrackNodes() {
        const map = new Map<string, TreeTrackNode[]>()
        for (const { item, mode } of self.rows) {
          if (mode === 'folder' && item.type === 'category') {
            map.set(item.id, getAllTrackNodes(item))
          }
        }
        return map
      },
      get folderCategoryStats() {
        const stats = new Map<string, { active: number; total: number }>()
        const { shownTrackIds } = self
        for (const [id, trackNodes] of this.folderTrackNodes) {
          let active = 0
          for (const n of trackNodes) {
            if (shownTrackIds.has(n.trackId)) {
              active++
            }
          }
          stats.set(id, { active, total: trackNodes.length })
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
          group.tracks.some(t => t.categories.length > 1),
        )
      },
    }))
    .actions(self => {
      // categoryMode/recentlyUsed keys are scoped to the assembly (+ view
      // type), which isn't known until the view resolves, so they load lazily.
      // `loadedScope` = the scope now in the model; persist writes only for
      // that scope, so load/persist order never matters and an assembly switch
      // can't write the old scope's state under the new key.
      let loadedScope: string | undefined

      function scopeKey(
        assemblyNames: string[],
        view: { type: string } | undefined,
      ) {
        return view ? `${assemblyNames.join(',')}|${view.type}` : ''
      }

      // One in-memory mode per category, persisted as the two lists it shipped
      // as, so an older build reads back what this one wrote
      function loadCategoryModes(assemblyNames: string[], viewType: string) {
        const session = getSession(self)
        const r = ['hierarchical', 'defaultCollapsed']
        const savedCollapsed = localStorageGetJSON<
          [string, boolean][] | undefined
        >(scopedK('collapsedCategories', assemblyNames, viewType), undefined)
        const savedFolders = localStorageGetJSON<string[] | undefined>(
          scopedK('folderCategories', assemblyNames, viewType),
          undefined,
        )

        self.clearCategoryModes()
        if (savedCollapsed) {
          for (const [id, collapsed] of savedCollapsed) {
            self.setCategoryCollapsed(id, collapsed)
          }
        } else {
          if (getConf(session, [...r, 'topLevelCategories'])) {
            self.collapseTopLevelCategories()
          }
          if (getConf(session, [...r, 'subCategories'])) {
            self.collapseSubCategories()
          }
          for (const elt of getConf(session, [...r, 'categoryNames'])) {
            self.setCategoryCollapsed(categoryId(mainGroupId, elt), true)
          }
        }
        // applied last: folder wins over a collapse recorded for the same
        // category, the two can't both be in effect
        const folders =
          savedFolders ??
          getConf(session, ['hierarchical', 'defaultFolderCategories']).map(
            (elt: string) => categoryId(mainGroupId, elt),
          )
        for (const id of folders) {
          self.setFolderCategory(id, true)
        }
      }

      function loadFromLocalStorage() {
        const { assemblyNames, view } = self
        self.setRecentlyUsed(
          localStorageGetJSON<string[]>(recentlyUsedK(assemblyNames), []),
        )
        if (view) {
          loadCategoryModes(assemblyNames, view.type)
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
          view,
        } = self
        const modes = [...self.categoryMode]
        // skip until load has populated this scope (guards against writing empty
        // defaults or a previous scope's state)
        if (scopeKey(assemblyNames, view) === loadedScope) {
          localStorageSetJSON(recentlyUsedK(assemblyNames), recentlyUsed)
          localStorageSetJSON(favoritesK(), favorites)
          localStorageSetJSON(sortTrackNamesK, sortTrackNames)
          localStorageSetJSON(sortCategoriesK, sortCategories)
          if (view) {
            localStorageSetJSON(
              scopedK('collapsedCategories', assemblyNames, view.type),
              modes
                .filter(([, m]) => m === 'collapsed')
                .map(([id]) => [id, true]),
            )
            localStorageSetJSON(
              scopedK('folderCategories', assemblyNames, view.type),
              modes.filter(([, m]) => m === 'folder').map(([id]) => id),
            )
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
