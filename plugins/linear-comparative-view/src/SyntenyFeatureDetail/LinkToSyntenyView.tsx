import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { ActionLink } from '@jbrowse/core/ui'
import {
  SimpleFeature,
  assembleLocString,
  getSession,
} from '@jbrowse/core/util'
import { allSessionTracks } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/canLaunchSyntenyForMate.ts'
import { getMate } from '../syntenyMate.ts'

import type { SyntenyFeatureDetailModel } from './types.ts'
import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/plugin-linear-genome-view'

// lazies
const LaunchSyntenyViewDialog = lazy(
  () => import('../LaunchSyntenyView/LaunchSyntenyViewDialog.tsx'),
)

// The launched view needs the track back, so its id has to resolve to a track
// config we can read `assemblyNames` off — the same gate the LGV synteny
// right-click menu applies. Without it, a one-vs-all mate that is only a PanSN
// sample label (no declared assembly) opens a synteny view that can resolve
// nothing and lands on the import form with an error.
//
// allSessionTracks rather than session.tracks, which holds only the session's
// own: a synteny track arriving from a connection is the case this link used to
// drop, hiding the launch on exactly the datasets that are loaded by reference.
function findTrackAssemblyNames(
  session: AbstractSessionModel,
  trackId: string | undefined,
) {
  const track = allSessionTracks(session).find(
    t => readConfObject(t, 'trackId') === trackId,
  )
  return track
    ? (readConfObject(track, 'assemblyNames') as string[] | undefined)
    : undefined
}

// The anchor panel opens on the view's own assembly — more dependable than the
// feature's own `assemblyName` field, which not every adapter sets (the same
// reasoning LGVSyntenyDisplay's context menu applies, see its comment). A
// ribbon click hands this widget the outer LinearSyntenyView itself, with
// `level` saying which row produced the feature; a track's own context menu
// instead hands over the single LGV it lives in, which has no rows to index.
export function findAnchorAssembly({ view, level }: SyntenyFeatureDetailModel) {
  return level !== undefined && 'views' in view
    ? view.views[level]?.assemblyNames[0]
    : view.assemblyNames[0]
}

// The tracks that panel already has open, for the launched view to open with —
// the same two shapes findAnchorAssembly resolves, so the tracks and the
// assembly always come from the same panel. A ribbon click with no `level` names
// no row, so it offers nothing rather than guessing one.
export function findAnchorTracks({
  view,
  level,
}: SyntenyFeatureDetailModel): TrackInit[] {
  if (!('views' in view)) {
    return anchorPanelTracks(view.tracks)
  }
  const row = level === undefined ? undefined : view.views[level]
  return row ? anchorPanelTracks(row.tracks) : []
}

const LinkToSyntenyView = observer(function LinkToSyntenyView({
  model,
  feat,
}: {
  model: SyntenyFeatureDetailModel
  feat: SimpleFeatureSerialized
}) {
  const { view, level, trackId } = model
  const session = getSession(model)
  const feature = new SimpleFeature(feat)
  const mate = getMate(feature)
  const anchorAssembly = findAnchorAssembly(model)
  const trackAssemblyNames = findTrackAssemblyNames(session, trackId)
  const canLaunch =
    trackId !== undefined &&
    anchorAssembly !== undefined &&
    trackAssemblyNames !== undefined &&
    canLaunchSyntenyForMate(trackAssemblyNames, mate?.assemblyName)
  return (
    <ul>
      {'views' in view ? (
        <li>
          <ActionLink
            onClick={() => {
              const { views } = view
              if (level !== undefined) {
                // level is "pre-known", and stored in the SyntenyFeatureWidget
                // model state e.g. when clicking on a feature from a
                // LinearSyntenyRendering
                views[level]?.navTo(feat, 0.2)
                views[level + 1]?.navTo(
                  feat.mate as SimpleFeatureSerialized,
                  0.2,
                )
              } else {
                // best effort to find the right level. this is triggered for
                // example if a user clicks on a feature in a LGVSyntenyDisplay
                // in an existing LinearSyntenyView, there is no real proper
                // level "pre-known" to this situation
                const f2 = feat.mate as SimpleFeatureSerialized
                const r1 = feat.assemblyName as string
                const r2 = f2.assemblyName as string
                const v1 = views.find(v => v.assemblyNames[0] === r1)
                const v2 = views.find(v => v.assemblyNames[0] === r2)
                if (!v1 || !v2) {
                  session.notify(
                    [
                      !v1
                        ? `Unable to find ${assembleLocString(feat)} in synteny view`
                        : '',
                      !v2
                        ? `Unable to find ${assembleLocString(f2)} in synteny view`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ... '),
                  )
                }
                v1?.navTo(feat, 0.2)
                v2?.navTo(f2, 0.2)
              }
            }}
          >
            Center view on this feature
          </ActionLink>
        </li>
      ) : null}
      {canLaunch ? (
        <li>
          <ActionLink
            onClick={() => {
              session.queueDialog(handleClose => [
                LaunchSyntenyViewDialog,
                {
                  session,
                  feature,
                  anchorAssembly,
                  anchorTracks: findAnchorTracks(model),
                  trackId,
                  handleClose,
                },
              ])
            }}
          >
            Launch new linear synteny view on this feature
          </ActionLink>
        </li>
      ) : null}
    </ul>
  )
})

export default LinkToSyntenyView
