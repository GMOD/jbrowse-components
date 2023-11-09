import {
  types,
  cast,
  Instance,
  SnapshotIn,
  IMSTArray,
  addDisposer,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { Region } from '@jbrowse/core/util/types'
import { Region as RegionModel, ElementId } from '@jbrowse/core/util/types/mst'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import {
  getSession,
  localStorageGetItem,
  localStorageSetItem,
} from '@jbrowse/core/util'
import { autorun } from 'mobx'

const LabeledRegionModel = types
  .compose(
    RegionModel,
    types.model('Label', {
      label: types.optional(types.string, ''),
      highlight: types.optional(
        types.string,
        `rgba(${Math.round(Math.random() * 255)}, ${Math.round(
          Math.random() * 255,
        )}, ${Math.round(Math.random() * 255)}, 0.3)`,
      ),
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
  typeof window !== undefined
    ? `bookmarks-${[window.location.host + window.location.pathname].join('-')}`
    : 'empty'

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
      get bookmarkAssemblies() {
        return [...new Set(self.bookmarks.map(r => r.assemblyName))]
      },
      get validAssemblies() {
        const { assemblyManager } = getSession(self)
        return new Set(
          this.bookmarkAssemblies.filter(a => assemblyManager.get(a)),
        )
      },
      get highlightToggle() {
        const { views } = getSession(self)
        const lgvs = views.filter(v =>
          Object.hasOwn(v, 'showBookmarkHighlights'),
        )
        const res = (lgvs as LinearGenomeViewModel[]).map(
          v => v.showBookmarkHighlights,
        )
        return new Set(res).size === 1 && res[0]
      },
      get labelToggle() {
        const { views } = getSession(self)
        const lgvs = views.filter(v => Object.hasOwn(v, 'showBookmarkLabels'))
        const res = (lgvs as LinearGenomeViewModel[]).map(
          v => v.showBookmarkLabels,
        )
        return new Set(res).size === 1 && res[0]
      },
    }))
    .views(self => ({
      get bookmarksWithValidAssemblies() {
        return self.bookmarks.filter(e =>
          self.validAssemblies.has(e.assemblyName),
        )
      },
    }))
    .views(self => ({
      get sharedBookmarksModel() {
        // requires cloning bookmarks with JSON.stringify/parse to avoid duplicate
        // reference to same object in the same state tree, will otherwise error
        // when performing share
        return SharedBookmarksModel.create({
          sharedBookmarks: JSON.parse(JSON.stringify(self.selectedBookmarks)),
        })
      },
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
      setSelectedAssemblies(assemblies?: string[]) {
        self.selectedAssembliesPre = assemblies
      },
    }))
    .views(self => ({
      get selectedAssemblies() {
        return (
          self.selectedAssembliesPre?.filter(f =>
            self.validAssemblies.has(f),
          ) ?? [...self.validAssemblies]
        )
      },
    }))
    .actions(self => ({
      importBookmarks(regions: Region[]) {
        self.bookmarks = cast([...self.bookmarks, ...regions])
      },
      addBookmark(region: Region) {
        self.bookmarks.push(region)
      },
      removeBookmark(index: number) {
        self.bookmarks.splice(index, 1)
      },
      updateBookmarkLabel(
        bookmark: IExtendedLabeledRegionModel,
        label: string,
      ) {
        bookmark.correspondingObj.setLabel(label)
      },
      updateBookmarkHighlight(
        bookmark: IExtendedLabeledRegionModel,
        color: string,
      ) {
        bookmark.correspondingObj.setHighlight(color)
      },
      updateBulkBookmarkHighlights(color: string) {
        if (self.selectedBookmarks.length !== 0) {
          self.selectedBookmarks.forEach(bookmark =>
            this.updateBookmarkHighlight(bookmark, color),
          )
        }
      },
      setSelectedBookmarks(bookmarks: IExtendedLabeledRegionModel[]) {
        self.selectedBookmarks = bookmarks
      },
      setBookmarkedRegions(regions: IMSTArray<typeof LabeledRegionModel>) {
        self.bookmarks = cast(regions)
      },
      setHighlightToggle(toggle: boolean) {
        const { views } = getSession(self)
        const lgvs = views.filter(v =>
          Object.hasOwn(v, 'showBookmarkHighlights'),
        )

        ;(lgvs as LinearGenomeViewModel[]).forEach(view => {
          view.toggleShowBookmarkHighlights(toggle)
        })
      },
      setLabelToggle(toggle: boolean) {
        const { views } = getSession(self)
        const lgvs = views.filter(v => Object.hasOwn(v, 'showBookmarkLabels'))

        ;(lgvs as LinearGenomeViewModel[]).forEach(view => {
          view.toggleShowBookmarkLabels(toggle)
        })
      },
    }))
    .actions(self => ({
      clearAllBookmarks() {
        for (const bookmark of self.bookmarks) {
          if (self.validAssemblies.has(bookmark.assemblyName)) {
            self.bookmarks.remove(bookmark)
          }
        }
      },
      clearSelectedBookmarks() {
        for (const bookmark of self.selectedBookmarks) {
          self.bookmarks.remove(bookmark.correspondingObj)
        }
        self.selectedBookmarks = []
      },
    }))
    .actions(self => ({
      afterAttach() {
        const key = localStorageKeyF()
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
