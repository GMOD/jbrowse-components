import { types, Instance } from 'mobx-state-tree'
import {
  getConf,
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { dedupe, getSession, notEmpty } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { filterTracks } from './filterTracks'
import { generateHierarchy } from './generateHierarchy'
import { findSubCategories, findTopLevelCategories } from './util'

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
       */
      favorites: types.array(types.string),
      /**
       * #property
       */
      recentlyUsed: types.array(types.string),
      /**
       * #property
       */
      showRecentlyUsedCategory: true,
      /**
       * #property
       */
      showFavoritesCategory: true,
    })
    .volatile(() => ({
      selection: [] as AnyConfigurationModel[],
      filterText: '',
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
      isFavorite(config: AnyConfigurationModel) {
        return self.favorites.includes(config.trackId)
      },
      /**
       * #action
       */
      addToFavorites(config: AnyConfigurationModel) {
        self.favorites.push(readConfObject(config, 'trackId'))
      },
      /**
       * #action
       */
      removeFromFavorites(config: AnyConfigurationModel) {
        const ele = self.favorites.find((id: string) => id === config.trackId)
        if (ele) {
          self.favorites.remove(ele)
        }
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
      isRecentlyUsed(config: AnyConfigurationModel) {
        return self.recentlyUsed.includes(config.trackId)
      },
      /**
       * #action
       */
      addToRecentlyUsed(id: string) {
        if (self.recentlyUsed.length >= 10) {
          self.recentlyUsed.shift()
        }
        self.recentlyUsed.push(id)
      },
      /**
       * #action
       */
      removeFromRecentlyUsed(config: AnyConfigurationModel) {
        const ele = self.recentlyUsed.find(
          (id: string) => id === config.trackId,
        )
        if (ele) {
          self.recentlyUsed.remove(ele)
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
      connectionTrackConfigurations(connection: {
        tracks: AnyConfigurationModel[]
      }) {
        return filterTracks(connection.tracks, self)
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

      /**
       * #getter
       * filters out tracks that are not in the favorites group
       */
      get favoriteTracks() {
        return this.trackConfigurations.filter(track =>
          self.favorites.includes(readConfObject(track, 'trackId')),
        )
      },

      /**
       * #getter
       * filters out tracks that are not in the recently used group
       */
      get recentlyUsedTracks() {
        return this.trackConfigurations.filter(track =>
          self.recentlyUsed.includes(readConfObject(track, 'trackId')),
        )
      },
    }))
    .views(self => ({
      get allTracks() {
        const { connectionInstances = [] } = getSession(self)
        return [
          {
            group: '✨Favorites',
            tracks: self.favoriteTracks,
            noCategories: true,
          },
          {
            group: '🕒 Recently used',
            tracks: self.recentlyUsedTracks,
            isOpenByDefault: false,
            noCategories: true,
          },
          {
            group: 'Tracks',
            tracks: self.trackConfigurations,
            noCategories: false,
          },
          ...connectionInstances.flatMap(c => ({
            group: getConf(c, 'name'),
            tracks: c.tracks,
            noCategories: false,
          })),
        ].filter(
          // filters out categories favorites and recently used if the user toggles them off
          category =>
            (category.group !== '✨Favorites' &&
              category.group !== '🕒 Recently used') ||
            (self.showFavoritesCategory && category.group === '✨Favorites') ||
            (self.showRecentlyUsedCategory &&
              category.group === '🕒 Recently used'),
        )
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
          children: self.allTracks.map(s => ({
            name: s.group,
            id: s.group,
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
      /**
       * #action
       */
      toggleRecentlyUsedCategory() {
        self.showRecentlyUsedCategory = !self.showRecentlyUsedCategory
      },
      /**
       * #action
       */
      toggleFavoritesCategory() {
        self.showFavoritesCategory = !self.showFavoritesCategory
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
      get hasAnySubcategories() {
        return self.allTracks.some(group =>
          group.tracks.some(t => readConfObject(t, 'category')?.length > 1),
        )
      },
    }))
}

export type HierarchicalTrackSelectorStateModel = ReturnType<
  typeof stateTreeFactory
>
export type HierarchicalTrackSelectorModel =
  Instance<HierarchicalTrackSelectorStateModel>
