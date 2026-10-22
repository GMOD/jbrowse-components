import { lazy } from 'react'

import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'

import { MULTI_ROW_WORKFLOW } from './workflowName.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiWiggleAddTrackWorkflowF(pm: PluginManager) {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: MULTI_ROW_WORKFLOW,
        displayName: 'Add multi-row track',
        ReactComponent: lazy(() => import('./AddTrackWorkflow.tsx')),
      }),
  )
}
