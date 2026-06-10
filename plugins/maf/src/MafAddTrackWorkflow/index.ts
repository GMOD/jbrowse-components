import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import MultiMAFWidget from './AddTrackWorkflow.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafAddTrackWorkflowF(pluginManager: PluginManager) {
  pluginManager.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'MAF track',
        displayName: 'Add multiple alignment (MAF) track',
        ReactComponent: MultiMAFWidget,
        stateModel: types.model({}),
      }),
  )
}
