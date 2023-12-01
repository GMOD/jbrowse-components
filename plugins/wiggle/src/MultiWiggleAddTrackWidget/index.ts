import PluginManager from '@jbrowse/core/PluginManager'
import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from 'mobx-state-tree'

// locals
import { lazy } from 'react'

export default (pm: PluginManager) => {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'Multi-wiggle track',
        ReactComponent: lazy(() => import('./AddTrackWorkflow')),
        stateModel: types.model({}),
      }),
  )
}
