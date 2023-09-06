import { types, cast, Instance, SnapshotIn, IMSTArray } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { Region } from '@jbrowse/core/util/types'
import { Region as RegionModel, ElementId } from '@jbrowse/core/util/types/mst'

const LabeledRegionModel = types
  .compose(
    RegionModel,
    types.model('Label', {
      label: types.optional(types.string, ''),
    }),
  )
  .actions(self => ({
    setLabel(label: string) {
      self.label = label
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
  assemblyName: string
  label: string
  setRefName: (newRefName: string) => void
  setLabel: (label: string) => void
}

export interface IExtendedLabeledRegionModel extends ILabeledRegionModel {
  id: number
  correspondingObj: ILabeledRegionModel
}

export default function f(_pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      id: ElementId,
      type: types.literal('GridBookmarkWidget'),
      bookmarkedRegions: types.array(LabeledRegionModel),
    })
    .volatile(() => ({
      selectedBookmarks: [] as IExtendedLabeledRegionModel[],
    }))
    .views(self => ({
      get sharedBookmarksModel() {
        return SharedBookmarksModel.create({
          sharedBookmarks: self.selectedBookmarks,
        })
      },
    }))
    .actions(self => ({
      importBookmarks(regions: Region[]) {
        self.bookmarkedRegions = cast([...self.bookmarkedRegions, ...regions])
      },
      addBookmark(region: Region) {
        self.bookmarkedRegions.push(region)
      },
      removeBookmark(index: number) {
        self.bookmarkedRegions.splice(index, 1)
      },
      clearAllBookmarks() {
        self.bookmarkedRegions.clear()
      },
      clearSelectedBookmarks() {
        self.selectedBookmarks.forEach(
          (selectedBookmark: IExtendedLabeledRegionModel) => {
            self.bookmarkedRegions.remove(selectedBookmark.correspondingObj)
          },
        )
        self.selectedBookmarks = []
      },
      updateBookmarkLabel(
        bookmark: IExtendedLabeledRegionModel,
        label: string,
      ) {
        const target = self.bookmarkedRegions.find(
          (element: ILabeledRegionModel) => {
            return element === bookmark.correspondingObj
          },
        )
        target?.setLabel(label)
      },
      setSelectedBookmarks(bookmarks: IExtendedLabeledRegionModel[]) {
        self.selectedBookmarks = bookmarks
      },
      setBookmarkedRegions(
        bookmarkedRegions: IMSTArray<typeof LabeledRegionModel>,
      ) {
        self.bookmarkedRegions = bookmarkedRegions
      },
    }))
    .views(self => ({
      get assemblies() {
        return [
          ...new Set(self.bookmarkedRegions.map(region => region.assemblyName)),
        ]
      },
    }))
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>
