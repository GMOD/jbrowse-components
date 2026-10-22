import { lazy } from 'react'

import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'

import { GWAS_WORKFLOW } from './workflowName.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASAddTrackWorkflowF(pm: PluginManager) {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: GWAS_WORKFLOW,
        displayName: 'Add GWAS track',
        ReactComponent: lazy(() => import('./AddTrackWorkflow.tsx')),
      }),
  )
}
