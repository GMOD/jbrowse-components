import { lazy } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfObject } from '@jbrowse/core/configuration'
import { ActionLink } from '@jbrowse/core/ui'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { allSessionTracks } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/canLaunchSyntenyForMate.ts'
import { getMate } from '../syntenyMate.ts'
import { syntenyCenterTargets } from './centerOnFeature.ts'

import type { SyntenyFeatureDetailModel } from './types.ts'
import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

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
function findAnchorTracks({
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
  const canCenter = 'views' in view
  // No card at all rather than an empty one titled "Link to view". A synteny
  // track opened inside a plain LGV has no rows to center, and a mate whose
  // assembly the track does not declare cannot launch a view either — which
  // left the panel showing a heading over an empty list.
  if (!canCenter && !canLaunch) {
    return null
  }
  return (
    <BaseCard title="Link to view">
      <ul>
        {canCenter ? (
          <li>
            <ActionLink
              onClick={() => {
                const { targets, missing } = syntenyCenterTargets({
                  views: view.views,
                  level,
                  feat,
                })
                // Both sides attempted, whichever fails. `navTo` throws for a
                // row whose displayed regions do not contain the feature — a
                // panel sent elsewhere while this widget sat open in the
                // drawer — and letting that escape a click handler both took
                // out the second row's navigation and went unreported.
                const problems = [...missing]
                for (const { view: row, loc } of targets) {
                  try {
                    row.navTo(loc, 0.2)
                  } catch (e) {
                    problems.push(`${e}`)
                  }
                }
                if (problems.length > 0) {
                  session.notify(problems.join(' ... '), 'warning')
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
                    // The view this widget was opened from, so the dialog can
                    // offer to put the launched view in its slot rather than
                    // below it — the same choice the two menu-driven launches
                    // make. Passed for both shapes and filtered by the dialog:
                    // `canReplaceView` keeps the offer to a view the session
                    // actually holds a slot for, which drops the LGV *row* of a
                    // synteny view (a ribbon click's widget names the outer
                    // view, which does have one) without this having to know
                    // which shape it got.
                    sourceView: view,
                    trackId,
                    handleClose,
                  },
                ])
              }}
            >
              Launch linear synteny view on this feature
            </ActionLink>
          </li>
        ) : null}
      </ul>
    </BaseCard>
  )
})

export default LinkToSyntenyView
