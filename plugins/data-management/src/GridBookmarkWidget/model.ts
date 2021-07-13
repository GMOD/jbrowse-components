import { types, Instance } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { Region as RegionModel } from '@jbrowse/core/util/types/mst'
import { Region } from '@jbrowse/core/util/types'

export default function f(pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      id: ElementId,
      type: types.literal('GridBookmarkWidget'),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      bookmarkedRegions: types.array(RegionModel),
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
    }))
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>
