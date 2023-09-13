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
      bookmarkedRegions: types.array(
        types.optional(LabeledRegionModel, () =>
          JSON.parse(
            localStorageGetItem(
              `bookmarks-${[
                window.location.host + window.location.pathname,
              ].join('-')}`,
            ) || '[]',
          ),
        ),
      ),
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
      get validAssemblies() {
        return [
          ...new Set(
            this.assemblies.filter((assembly: string) =>
              getSession(self).assemblyNames.includes(assembly),
            ),
          ),
        ]
      },
      get bookmarksWithValidAssemblies() {
        return (
          JSON.parse(
            JSON.stringify(self.bookmarkedRegions),
          ) as unknown as ILabeledRegionModel[]
        ).filter(ele => this.validAssemblies.includes(ele.assemblyName))
      },
      get allBookmarksModel() {
        return SharedBookmarksModel.create({
          sharedBookmarks: this.bookmarksWithValidAssemblies,
        })
      },
    }))
    .volatile(self => ({
      selectedAssemblies: self.assemblies.filter((assembly: string) =>
        getSession(self).assemblyNames.includes(assembly),
      ),
    }))
    .actions(self => ({
      setSelectedAssemblies(assemblies: string[]) {
        self.selectedAssemblies = assemblies
      },
      clearAllBookmarks() {
        self.bookmarkedRegions.forEach(bookmark => {
          if (self.validAssemblies.includes(bookmark.assemblyName)) {
            self.bookmarkedRegions.remove(bookmark)
          }
        })
      },
      clearSelectedBookmarks() {
        self.selectedBookmarks.forEach(
          (selectedBookmark: IExtendedLabeledRegionModel) => {
            self.bookmarkedRegions.remove(selectedBookmark.correspondingObj)
          },
        )
        self.selectedBookmarks = []
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const target = `bookmarks-${[
              window.location.host + window.location.pathname,
            ].join('-')}`
            if (self.bookmarkedRegions.length > 0) {
              localStorageSetItem(
                target,
                JSON.stringify(self.bookmarkedRegions),
              )
            } else {
              self.setBookmarkedRegions(
                JSON.parse(localStorageGetItem(target) || '[]'),
              )
            }
          }),
        )
      },
    }))
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>
