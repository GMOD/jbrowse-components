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
        self.bookmarkedRegions
          .find(elt => elt === bookmark.correspondingObj)
          ?.setLabel(label)
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
        return [...new Set(self.bookmarkedRegions.map(r => r.assemblyName))]
      },
      get validAssemblies() {
        return new Set(
          this.assemblies.filter((assembly: string) =>
            getSession(self).assemblyNames.includes(assembly),
          ),
        )
      },
    }))
    .views(self => ({
      get bookmarksWithValidAssemblies() {
        return self.bookmarkedRegions.filter(ele =>
          self.validAssemblies.has(ele.assemblyName),
        )
      },
    }))
    .views(self => ({
      get allBookmarksModel() {
        return SharedBookmarksModel.create({
          sharedBookmarks: self.bookmarksWithValidAssemblies,
        })
      },
    }))
    .volatile(() => ({
      selectedAssembly: undefined as string | undefined,
    }))

    .actions(self => ({
      setSelectedAssembly(assembly: string) {
        self.selectedAssembly =
          assembly === 'SPECIAL_ALL_ASSEMBLIES_VALUE' ? undefined : assembly
      },
      clearAllBookmarks() {
        self.bookmarkedRegions.forEach(bookmark => {
          if (self.validAssemblies.has(bookmark.assemblyName)) {
            self.bookmarkedRegions.remove(bookmark)
          }
        })
      },
      clearSelectedBookmarks() {
        self.selectedBookmarks.forEach(selectedBookmark => {
          self.bookmarkedRegions.remove(selectedBookmark.correspondingObj)
        })
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
