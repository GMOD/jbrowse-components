import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfObject } from '@jbrowse/core/configuration'
import { ActionLink } from '@jbrowse/core/ui'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { allSessionTracks } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { pairwiseSyntenyLaunch } from '../LaunchSyntenyView/pairwiseSyntenyLaunch.ts'
import { syntenyCenterTargets } from './centerOnFeature.ts'

import type { SyntenyFeatureDetailModel } from './types.ts'
import type { SimpleFeatureSerialized, TrackCatalog } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The launched view needs the track back, so its id has to resolve to a track
// config we can read `assemblyNames` off — the same gate the LGV synteny
// right-click menu applies. Without it, a one-vs-all mate that is only a PanSN
// sample label (no declared assembly) opens a synteny view that can resolve
// nothing and lands on the import form with an error.
//
// allSessionTracks rather than session.tracks, which holds only the session's
// own: a synteny track arriving from a connection is the case this link used to
// drop, hiding the launch on exactly the datasets that are loaded by reference.
function findTrack(session: TrackCatalog, trackId: string | undefined) {
  return allSessionTracks(session).find(
    t => readConfObject(t, 'trackId') === trackId,
  )
}

// The panel the launch is anchored on: its assembly is the anchor's, its tracks
// carry over, and its visible window is what the dialog offers to clip to. A
// track's own context menu hands this widget the single LGV it lives in; a
// ribbon click hands over the outer LinearSyntenyView itself, with `level`
// saying which row produced the feature, and names no row without one.
export function anchorRow({
  view,
  level,
}: SyntenyFeatureDetailModel): LinearGenomeViewModel | undefined {
  if (!('views' in view)) {
    return view
  }
  return level === undefined ? undefined : view.views[level]
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
  const row = anchorRow(model)
  const track = findTrack(session, trackId)
  const launch =
    row && track
      ? pairwiseSyntenyLaunch({
          host: session,
          feature: new SimpleFeature(feat),
          anchorView: row,
          track,
          // The view this widget was opened from, so the dialog can offer to
          // put the launched view in its slot rather than below it — the same
          // choice the two menu-driven launches make. Passed for both shapes
          // and filtered by the dialog: `canReplaceView` keeps the offer to a
          // view the session actually holds a slot for, which drops the LGV
          // *row* of a synteny view (a ribbon click's widget names the outer
          // view, which does have one) without this having to know which
          // shape it got.
          sourceView: view,
        })
      : undefined
  const canCenter = 'views' in view
  // No card at all rather than an empty one titled "Link to view". A synteny
  // track opened inside a plain LGV has no rows to center, and a mate whose
  // assembly the track does not declare cannot launch a view either — which
  // left the panel showing a heading over an empty list.
  if (!canCenter && !launch) {
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
        {launch ? (
          <li>
            <ActionLink onClick={launch}>
              Launch linear synteny view on this feature
            </ActionLink>
          </li>
        ) : null}
      </ul>
    </BaseCard>
  )
})

export default LinkToSyntenyView
