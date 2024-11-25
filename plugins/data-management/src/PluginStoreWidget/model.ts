import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('PluginStoreModel', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('PluginStoreWidget'),
      /**
       * #property
       */
      filterText: '',
      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .actions(self => ({
      /**
       * #action
       */
      clearFilterText() {
        self.filterText = ''
      },
      /**
       * #action
       */
      setFilterText(newText: string) {
        self.filterText = newText
      },
    }))
}

export type PluginStoreStateModel = ReturnType<typeof stateModelFactory>
export type PluginStoreModel = Instance<PluginStoreStateModel>
