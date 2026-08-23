import { lazy } from 'react'

import { getDialogHost } from '@jbrowse/core/util'

import type {
  AbstractTrackModel,
  AbstractViewModel,
  Feature,
} from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const ReadVsRefDialog = lazy(() => import('./ReadVsRefDialog.tsx'))

// What the shared dialog has resolved by the time a launcher runs: the read's
// primary alignment (never the supplementary that may have been clicked) and
// the genomic padding to put around each aligned segment.
export interface ReadVsRefLaunchArgs {
  primaryFeature: Feature
  windowSize: number
  track: AbstractTrackModel
  // The view the read was clicked in, set when the dialog's "Replace current
  // view" was used rather than "Open in new view". Pass it straight to
  // addOrReplaceView, which falls back to appending on a session that can't
  // replace a view.
  replacing?: AbstractViewModel
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
  getDialogHost(node).queueDialog(handleClose => [
    ReadVsRefDialog,
    { track, feature, handleClose, onSubmit },
  ])
}
