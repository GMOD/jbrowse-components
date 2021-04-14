/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'

export default function f(pluginManager: PluginManager) {
  return types.model('PluginStoreModel', {
    id: ElementId,
    type: types.literal('PluginStoreWidget'),
    view: types.safeReference(
      pluginManager.pluggableMstType('view', 'stateModel'),
    ),
  })
}

export type PluginStoreStateModel = ReturnType<typeof f>
export type PluginStoreModel = Instance<PluginStoreStateModel>
