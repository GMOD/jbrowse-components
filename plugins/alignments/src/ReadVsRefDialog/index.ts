import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const ReadVsRefDialog = lazy(() => import('./ReadVsRefDialog.tsx'))

// What the shared dialog has resolved by the time a launcher runs: the read's
// primary alignment (never the supplementary that may have been clicked) and
// the genomic padding to put around each aligned segment.
export interface ReadVsRefLaunchArgs {
  primaryFeature: Feature
  windowSize: number
  track: AbstractTrackModel
}

/**
 * Open the shared "read vs ref" launch dialog. `onSubmit` receives the resolved
 * primary alignment and window size and builds whichever view it is launching;
 * throwing from it surfaces in the dialog rather than as a bare notification,
 * and the dialog closes only once it resolves.
 */
export function queueReadVsRefDialog({
  node,
  track,
  feature,
  onSubmit,
}: {
  node: IAnyStateTreeNode
  track: AbstractTrackModel
  feature: Feature
  onSubmit: (args: ReadVsRefLaunchArgs) => void | Promise<void>
}) {
  getSession(node).queueDialog(handleClose => [
    ReadVsRefDialog,
    { track, feature, handleClose, onSubmit },
  ])
}
