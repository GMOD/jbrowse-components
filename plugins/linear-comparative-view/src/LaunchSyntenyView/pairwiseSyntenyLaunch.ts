import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'

import { getMate } from '../syntenyMate.ts'
import { anchorPanelTracks } from './anchorPanelTracks.ts'
import { canLaunchSyntenyForMate } from './canLaunchSyntenyForMate.ts'
import { visibleSpanOnFeature } from './visibleSpanOnRefName.ts'

import type { RegionOfInterest } from './resolvePanel.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  AbstractViewContainer,
  AbstractViewModel,
  AssemblyHost,
  DialogHost,
  Feature,
  NotificationSink,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LaunchSyntenyViewDialog = lazy(
  () => import('./LaunchSyntenyViewDialog.tsx'),
)

/**
 * The pairwise launch one alignment offers from the panel it is drawn in: the
 * click handler that opens the dialog, or undefined where no synteny view can
 * open on it. The LGV synteny right-click and the feature-detail link both
 * offer this; each used to assemble the same seven dialog props and the same
 * gate by hand.
 *
 * The anchor panel opens on the panel's own assembly, which is what the
 * features were fetched against — more dependable than the feature's own
 * `assemblyName` field, which not every adapter sets. It opens with that
 * panel's tracks too, this chain track excluded, since it becomes the ribbon
 * band. Whether the launch is offered at all depends on the mate's assembly,
 * which is per-feature: a one-vs-all mate can be a PanSN sample that is no
 * declared assembly of the track, and a view on it would fail to open.
 *
 * `region` is the slice of the anchor axis the dialog offers to clip both
 * panels to. A right-click passes the block the cursor was in — a feature
 * abutting a region boundary overlaps two visible blocks, and only the cursor
 * says which one it was drawn in — and every other caller gets the panel's
 * visible window on the feature's contig. Without one, a liftOver chain
 * launched from the feature widget framed both panels on the whole chromosome.
 */
export function pairwiseSyntenyLaunch({
  host,
  feature,
  anchorView,
  track,
  region,
  sourceView,
}: {
  host: AbstractViewContainer & AssemblyHost & DialogHost & NotificationSink
  feature: Feature
  anchorView: LinearGenomeViewModel
  track: AnyConfigurationModel
  region?: RegionOfInterest
  // the launching view, which the dialog offers to put the result in place of
  sourceView?: AbstractViewModel
}): (() => void) | undefined {
  const anchorAssembly = anchorView.assemblyNames[0]
  const trackAssemblyNames = readConfObject(track, 'assemblyNames') as string[]
  if (
    anchorAssembly === undefined ||
    !canLaunchSyntenyForMate(trackAssemblyNames, getMate(feature)?.assemblyName)
  ) {
    return undefined
  }
  return () => {
    host.queueDialog(handleClose => [
      LaunchSyntenyViewDialog,
      {
        region: region ?? visibleSpanOnFeature(host, anchorView, feature),
        trackId: readConfObject(track, 'trackId') as string,
        handleClose,
        session: host,
        anchorAssembly,
        anchorTracks: anchorPanelTracks(anchorView.tracks),
        sourceView,
        feature,
      },
    ])
  }
}
