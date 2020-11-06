import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'

export default function f(pluginManager: PluginManager) {
  return types.model('AddTrackModel', {
    id: ElementId,
    type: types.literal('AddTrackWidget'),
    view: types.safeReference(
      pluginManager.pluggableMstType('view', 'stateModel'),
    ),
  })
}

export type AddTrackStateModel = ReturnType<typeof f>
export type AddTrackModel = Instance<AddTrackStateModel>
