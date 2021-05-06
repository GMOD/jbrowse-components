import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'

export default function f(pluginManager: PluginManager) {
  return types
    .model('PluginStoreModel', {
      id: ElementId,
      type: types.literal('PluginStoreWidget'),
      filterText: '',
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .actions(self => ({
      clearFilterText() {
        self.filterText = ''
      },
      setFilterText(newText: string) {
        self.filterText = newText
      },
    }))
}

export type PluginStoreStateModel = ReturnType<typeof f>
export type PluginStoreModel = Instance<PluginStoreStateModel>
