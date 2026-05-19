import { lazy } from 'react'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const BreakpointSplitViewChoiceDialog = lazy(
  () => import('./BreakpointSplitViewChoiceDialog.tsx'),
)

export function launchBreakpointSplitView({
  session,
  feature,
  assemblyName,
  view,
  stableViewId,
}: {
  session: AbstractSessionModel
  feature: Feature
  assemblyName: string
  view?: LinearGenomeViewModel
  stableViewId?: string
}) {
  session.queueDialog(handleClose => [
    BreakpointSplitViewChoiceDialog,
    { handleClose, session, feature, assemblyName, view, stableViewId },
  ])
}
