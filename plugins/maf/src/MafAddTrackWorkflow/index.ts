import { lazy } from 'react'

import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

const MultiMAFWidget = lazy(() => import('./AddTrackWorkflow.tsx'))

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
