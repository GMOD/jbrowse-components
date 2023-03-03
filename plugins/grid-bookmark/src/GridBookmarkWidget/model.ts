import { types, cast, Instance } from 'mobx-state-tree'
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

export default function f(pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      id: ElementId,
      type: types.literal('GridBookmarkWidget'),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      bookmarkedRegions: types.array(LabeledRegionModel),
      modelSelectedAssembly: '',
    })
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
      updateBookmarkLabel(index: number, label: string) {
        self.bookmarkedRegions[index]?.setLabel(label)
      },
      setSelectedAssembly(assembly: string) {
        self.modelSelectedAssembly = assembly
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
