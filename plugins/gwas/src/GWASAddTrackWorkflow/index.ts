import { lazy } from 'react'

import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GWASAddTrackWorkflowF(pm: PluginManager) {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'GWAS / Manhattan track',
        ReactComponent: lazy(() => import('./AddTrackWorkflow.tsx')),
        stateModel: types.model({}),
      }),
  )
}
