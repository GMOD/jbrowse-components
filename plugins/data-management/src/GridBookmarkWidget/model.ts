import { types, Instance } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { Region } from '@jbrowse/core/util/types'

const BookmarkedRegion = types.model('BookmarkedRegion', {
  chrom: types.string,
  start: types.number,
  end: types.number,
  assemblyName: types.string,
  id: types.string,
})

export default function f(pluginManager: PluginManager) {
  return types
    .model('GridBookmarkModel', {
      id: ElementId,
      type: types.literal('GridBookmarkWidget'),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      bookmarkArray: types.array(BookmarkedRegion),
    })
    .actions(self => ({
      addBookmark(region: Region) {
        const { refName: chrom, start, end, assemblyName, key } = region
        // console.log({ chrom, start, end, assembly, locString })
        const id = key as string
        self.bookmarkArray.push({ chrom, start, end, assemblyName, id })
        console.log(self.bookmarkArray)
      },
    }))
}

export type GridBookmarkStateModel = ReturnType<typeof f>
export type GridBookmarkModel = Instance<GridBookmarkStateModel>
