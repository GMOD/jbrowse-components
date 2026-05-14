import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import MultiMAFWidget from './AddTrackWorkflow'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafAddTrackWorkflowF(pluginManager: PluginManager) {
  pluginManager.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'MAF track',
        ReactComponent: MultiMAFWidget,
        stateModel: types.model({}),
      }),
  )
}
