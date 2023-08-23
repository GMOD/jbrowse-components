import { types, cast, Instance, SnapshotIn, IMSTArray } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { Region } from '@jbrowse/core/util/types'
import { Region as RegionModel, ElementId } from '@jbrowse/core/util/types/mst'

const LabeledRegionModel = types
  .compose(
    RegionModel,
    types.model('Label', { label: types.optional(types.string, '') }),
  )
  .actions(self => ({
    setLabel(label: string) {
      self.label = label
    },
  }))

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

export default function f(pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      id: ElementId,
      type: types.literal('GridBookmarkWidget'),
      bookmarkedRegions: types.array(LabeledRegionModel),
      modelSelectedAssembly: '',
    })
    .volatile(self => ({
      selectedBookmarkIndexes: [] as Array<number>,
    }))
    .views(self => ({
      get selectedBookmarks() {
        const selectedBookmarks = [] as Array<ILabeledRegionModel>
        self.selectedBookmarkIndexes.forEach((index: number) => {
          selectedBookmarks.push(self.bookmarkedRegions[index])
        })
        return selectedBookmarks
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
          (selectedBookmark: ILabeledRegionModel) => {
            self.bookmarkedRegions.remove(selectedBookmark)
          },
        )
        self.selectedBookmarkIndexes = []
      },
      updateBookmarkLabel(index: number, label: string) {
        self.bookmarkedRegions[index]?.setLabel(label)
      },
      setSelectedAssembly(assembly: string) {
        self.modelSelectedAssembly = assembly
      },
      setSelectedBookmarkIndexes(indexes: Array<number>) {
        self.selectedBookmarkIndexes = indexes
      },
      setBookmarkedRegions(a: IMSTArray<typeof LabeledRegionModel>) {
        self.bookmarkedRegions = a
      },
    }))
    .views(self => ({
      get selectedAssembly() {
        return (
          self.modelSelectedAssembly ||
          (self.bookmarkedRegions.length
            ? self.bookmarkedRegions[0].assemblyName
            : '')
        )
      },
      get assemblies() {
        return [
          ...new Set(self.bookmarkedRegions.map(region => region.assemblyName)),
        ]
      },
    }))
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>
