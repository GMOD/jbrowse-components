import { lazy } from 'react'
import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'

// locals

export default function MultiWiggleAddTrackWorkflowF(pm: PluginManager) {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'Multi-wiggle track',
        ReactComponent: lazy(() => import('./AddTrackWorkflow')),
        stateModel: types.model({}),
      }),
  )
}
