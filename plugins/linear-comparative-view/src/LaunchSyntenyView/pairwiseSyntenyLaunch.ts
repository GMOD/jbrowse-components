import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'

import { getMate } from '../syntenyMate.ts'
import { canLaunchSyntenyForMate } from './canLaunchSyntenyForMate.ts'

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
import type { TrackInit } from '@jbrowse/core/util/tracks'

const LaunchSyntenyViewDialog = lazy(
  () => import('./LaunchSyntenyViewDialog.tsx'),
)

/**
 * The pairwise launch one alignment offers from the view it is drawn in: the
 * click handler that opens the dialog, or undefined where no synteny view can
 * open on it. The LGV synteny right-click, the feature-detail link and a ribbon
 * on the circle all offer this.
 *
 * The anchor panel opens on `anchorAssembly`, the genome the feature's own side
 * is on, with `anchorTracks`; the mate panel with `mateTracks`, keyed by the
 * mate's assembly name as the feature spells it. Whether the launch is offered
 * at all depends on the mate's assembly, which is per-feature: a one-vs-all
 * mate can be a PanSN sample that is no declared assembly of the track, and a
 * view on it would fail to open.
 *
 * `region` is the slice of the anchor axis the dialog offers to clip both
 * panels to: the block a right-click was in, or the launching panel's visible
 * window on the feature's contig. Without one the panels frame the alignment's
 * own spans.
 */
export function pairwiseSyntenyLaunch({
  host,
  feature,
  anchorAssembly,
  anchorTracks,
  mateTracks,
  track,
  region,
  sourceView,
}: {
  host: AbstractViewContainer & AssemblyHost & DialogHost & NotificationSink
  feature: Feature
  anchorAssembly: string | undefined
  anchorTracks?: TrackInit[]
  mateTracks?: Record<string, TrackInit[]>
  track: AnyConfigurationModel
  region?: RegionOfInterest
  // the launching view, which the dialog offers to put the result in place of
  sourceView?: AbstractViewModel
}): (() => void) | undefined {
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
        region,
        trackId: readConfObject(track, 'trackId') as string,
        handleClose,
        session: host,
        anchorAssembly,
        anchorTracks,
        mateTracks,
        sourceView,
        feature,
      },
    ])
  }
}

export function pairwiseLaunchLabel(mateAssemblyName: string) {
  return `Linear synteny view with ${mateAssemblyName}`
}
