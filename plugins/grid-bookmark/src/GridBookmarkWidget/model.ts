import {
  getSession,
  localStorageGetItem,
  localStorageSetItem,
} from '@jbrowse/core/util'
import { Region as RegionModel, ElementId } from '@jbrowse/core/util/types/mst'

import { autorun } from 'mobx'
import { types, cast, addDisposer } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance, SnapshotIn, IMSTArray } from 'mobx-state-tree'

const LabeledRegionModel = types
  .compose(
    RegionModel,
    types.model('Label', {
      label: types.optional(types.string, ''),
      highlight: types.optional(types.string, 'rgba(247, 129, 192, 0.35)'),
    }),
  )
  .actions(self => ({
    setLabel(label: string) {
      self.label = label
    },
    setHighlight(color: string) {
      self.highlight = color
    },
  }))

const SharedBookmarksModel = types.model('SharedBookmarksModel', {
  sharedBookmarks: types.maybe(types.array(LabeledRegionModel)),
})

export interface IExtendedLGV extends LinearGenomeViewModel {
  showBookmarkHighlights: boolean
  showBookmarkLabels: boolean
  toggleShowBookmarkHighlights: (arg: boolean) => void
  toggleShowBookmarkLabels: (arg: boolean) => void
}

export interface ILabeledRegionModel
  extends SnapshotIn<typeof LabeledRegionModel> {
  refName: string
  start: number
  end: number
  reversed: boolean
  highlight: string
  assemblyName: string
  label: string
  setRefName: (newRefName: string) => void
  setLabel: (label: string) => void
  setHighlight: (color: string) => void
}

export interface IExtendedLabeledRegionModel extends ILabeledRegionModel {
  id: number
  correspondingObj: ILabeledRegionModel
}

const localStorageKeyF = () =>
  typeof window !== 'undefined'
    ? `bookmarks-${[window.location.host + window.location.pathname].join('-')}`
    : 'empty'

/**
 * #stateModel GridBookmarkWidgetModel
 */
export default function f(_pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('GridBookmarkWidget'),
      /**
       * #property
       * removed by postProcessSnapshot, only loaded from localStorage
       */
      bookmarks: types.optional(types.array(LabeledRegionModel), () =>
        JSON.parse(localStorageGetItem(localStorageKeyF()) || '[]'),
      ),
    })
    .volatile(() => ({
      selectedBookmarks: [] as IExtendedLabeledRegionModel[],
      selectedAssembliesPre: undefined as string[] | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get bookmarkAssemblies() {
        return [...new Set(self.bookmarks.map(r => r.assemblyName))]
      },
      /**
       * #getter
       */
      get validAssemblies() {
        const { assemblyManager } = getSession(self)
        return new Set(
          this.bookmarkAssemblies.filter(a => assemblyManager.get(a)),
        )
      },
      /**
       * #getter
       */
      get areBookmarksHighlightedOnAllOpenViews() {
        const { views } = getSession(self)
        return views.every(v =>
          'showBookmarkHighlights' in v ? v.showBookmarkHighlights : true,
        )
      },
      /**
       * #getter
       */
      get areBookmarksHighlightLabelsOnAllOpenViews() {
        const { views } = getSession(self)
        return views.every(v =>
          'showBookmarkLabels' in v ? v.showBookmarkLabels : true,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get bookmarksWithValidAssemblies() {
        return self.bookmarks.filter(e =>
          self.validAssemblies.has(e.assemblyName),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get sharedBookmarksModel() {
        // requires cloning bookmarks with JSON.stringify/parse to avoid duplicate
        // reference to same object in the same state tree, will otherwise error
        // when performing share
        return SharedBookmarksModel.create({
          sharedBookmarks: JSON.parse(JSON.stringify(self.selectedBookmarks)),
        })
      },
      /**
       * #getter
       */
      get allBookmarksModel() {
        // requires cloning bookmarks with JSON.stringify/parse to avoid duplicate
        // reference to same object in the same state tree, will otherwise error
        // when performing share
        return SharedBookmarksModel.create({
          sharedBookmarks: JSON.parse(
            JSON.stringify(self.bookmarksWithValidAssemblies),
          ),
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSelectedAssemblies(assemblies?: string[]) {
        self.selectedAssembliesPre = assemblies
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get selectedAssemblies() {
        return (
          self.selectedAssembliesPre?.filter(f =>
            self.validAssemblies.has(f),
          ) ?? [...self.validAssemblies]
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      importBookmarks(regions: Region[]) {
        self.bookmarks = cast([...self.bookmarks, ...regions])
      },
      /**
       * #action
       */
      addBookmark(region: Region) {
        self.bookmarks.push(region)
      },
      /**
       * #action
       */
      removeBookmark(index: number) {
        self.bookmarks.splice(index, 1)
      },
      /**
       * #action
       */
      updateBookmarkLabel(
        bookmark: IExtendedLabeledRegionModel,
        label: string,
      ) {
        bookmark.correspondingObj.setLabel(label)
      },
      /**
       * #action
       */
      updateBookmarkHighlight(
        bookmark: IExtendedLabeledRegionModel,
        color: string,
      ) {
        bookmark.correspondingObj.setHighlight(color)
      },
      /**
       * #action
       */
      updateBulkBookmarkHighlights(color: string) {
        self.selectedBookmarks.forEach(bookmark => {
          this.updateBookmarkHighlight(bookmark, color)
        })
      },
      /**
       * #action
       */
      setSelectedBookmarks(bookmarks: IExtendedLabeledRegionModel[]) {
        self.selectedBookmarks = bookmarks
      },
      /**
       * #action
       */
      setBookmarkedRegions(regions: IMSTArray<typeof LabeledRegionModel>) {
        self.bookmarks = cast(regions)
      },
      /**
       * #action
       */
      setHighlightToggle(toggle: boolean) {
        const { views } = getSession(self)
        views.forEach(view => {
          // @ts-expect-error
          view.toggleShowBookmarkHighlights?.(toggle)
        })
      },
      /**
       * #action
       */
      setLabelToggle(toggle: boolean) {
        const { views } = getSession(self)
        views.forEach(view => {
          // @ts-expect-error
          view.toggleShowBookmarkLabels?.(toggle)
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      clearAllBookmarks() {
        self.setBookmarkedRegions(
          self.bookmarks.filter(
            bookmark => !self.validAssemblies.has(bookmark.assemblyName),
          ) as IMSTArray<typeof LabeledRegionModel>,
        )
      },
      /**
       * #action
       */
      clearSelectedBookmarks() {
        for (const bookmark of self.selectedBookmarks) {
          self.bookmarks.remove(bookmark.correspondingObj)
        }
        self.selectedBookmarks = []
      },

      removeBookmarkObject(arg: Instance<typeof LabeledRegionModel>) {
        self.bookmarks.remove(arg)
      },
    }))
    .actions(self => ({
      afterAttach() {
        const key = localStorageKeyF()
        function handler(e: StorageEvent) {
          if (e.key === key) {
            const localStorage = JSON.parse(localStorageGetItem(key) || '[]')
            self.setBookmarkedRegions(localStorage)
          }
        }
        window.addEventListener('storage', handler)
        addDisposer(self, () => {
          window.removeEventListener('storage', handler)
        })
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem(key, JSON.stringify(self.bookmarks))
          }),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      const { bookmarks: _, ...rest } = snap as Omit<typeof snap, symbol>
      return rest
    })
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>
