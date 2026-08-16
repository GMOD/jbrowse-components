import { lazy } from 'react'

import type { FindJunctionsNear } from './walkBreakendChain.ts'
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
  findJunctionsNear,
  defaultTrackIds,
}: {
  session: AbstractSessionModel
  feature: Feature
  assemblyName: string
  view?: LinearGenomeViewModel
  stableViewId?: string
  /**
   * Lets the dialog offer to open the whole chain of co-located junctions rather
   * than the clicked record's two ends. Supply it from an entry point that can
   * read the callset the record came from; leave it off and the dialog does not
   * offer the option at all, which is the honest state for a launch from a read's
   * SA mate or from a pasted row.
   */
  findJunctionsNear?: FindJunctionsNear
  /**
   * Tracks every panel opens when there is no `view` to copy from. The SV
   * inspector passes the callset it loaded, so a split view launched from a row
   * or a chord shows the record that sent it there; without it the panels
   * arrive at the right loci holding nothing.
   *
   * Ids rather than track snapshots, because a snapshot has to carry the track
   * type and a launcher holding only a trackId would have to go and look it up
   * — which `showTrack` already does, off the config.
   */
  defaultTrackIds?: string[]
}) {
  session.queueDialog(handleClose => [
    BreakpointSplitViewChoiceDialog,
    {
      handleClose,
      session,
      feature,
      assemblyName,
      view,
      stableViewId,
      findJunctionsNear,
      defaultTrackIds,
    },
  ])
}
