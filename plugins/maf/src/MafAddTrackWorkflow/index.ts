import { lazy } from 'react'

import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'

import { MAF_WORKFLOW } from './workflowName.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const MultiMAFWidget = lazy(() => import('./AddTrackWorkflow.tsx'))

export default function MafAddTrackWorkflowF(pluginManager: PluginManager) {
  pluginManager.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: MAF_WORKFLOW,
        displayName: 'Add multiple alignment (MAF) track',
        ReactComponent: MultiMAFWidget,
      }),
  )
}
