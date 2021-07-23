import { types, Instance } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { Region as RegionModel } from '@jbrowse/core/util/types/mst'
import { Region } from '@jbrowse/core/util/types'

const LabeledRegionModel = types.compose(
  RegionModel,
  types.model('Label', { label: '' }),
)

export default function f(pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      id: ElementId,
      type: types.literal('GridBookmarkWidget'),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      bookmarkedRegions: types.array(LabeledRegionModel),
      selectedAssembly: '',
    })
    .actions(self => ({
      addBookmark(region: Region) {
        const regionLocString = `${region.refName}:${region.start}..${region.end}`
        const index = self.bookmarkedRegions.findIndex(b => {
          const bLocString = `${b.refName}:${b.start}..${b.end}`
          return bLocString === regionLocString
        })
        if (index === -1) {
          self.bookmarkedRegions.push(region)
        }
      },
      removeBookmark(locString: string) {
        const index = self.bookmarkedRegions.findIndex(b => {
          const bLocString = `${b.refName}:${b.start}..${b.end}`
          return bLocString === locString
        })
        if (index !== -1) {
          self.bookmarkedRegions.splice(index, 1)
        }
      },
      clearAllBookmarks() {
        self.bookmarkedRegions.clear()
      },
      updateBookmarkLabel(locString: string, label: string) {
        const index = self.bookmarkedRegions.findIndex(b => {
          const bLocString = `${b.refName}:${b.start}..${b.end}`
          return bLocString === locString
        })
        if (index !== -1) {
          self.bookmarkedRegions[index].label = label
        }
      },
      setSelectedAssembly(assembly: string) {
        self.selectedAssembly = assembly
      },
    }))
    .views(self => ({
      get assemblies() {
        const assemblies = self.bookmarkedRegions.map(
          region => region.assemblyName,
        )
        const uniqueAssemblies = Array.from(new Set(assemblies))
        return uniqueAssemblies
      },
    }))
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>
