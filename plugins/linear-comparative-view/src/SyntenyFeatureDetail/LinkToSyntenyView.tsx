import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfObject } from '@jbrowse/core/configuration'
import { ActionLink } from '@jbrowse/core/ui'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { openMateLabel } from '@jbrowse/core/util/tracks'
import { allSessionTracks } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { allAssembliesLaunchItems } from '../LaunchSyntenyView/allAssembliesLaunch.ts'
import { anchorPanelTracks } from '../LaunchSyntenyView/anchorPanelTracks.ts'
import { openMateInLinearView } from '../LaunchSyntenyView/openMateInLinearView.ts'
import { pairwiseSyntenyLaunch } from '../LaunchSyntenyView/pairwiseSyntenyLaunch.ts'
import { visibleSpanOnFeature } from '../LaunchSyntenyView/visibleSpanOnRefName.ts'
import { getMate } from '../syntenyMate.ts'
import { centerStackOnFeature } from './centerOnFeature.ts'

import type { SyntenyFeatureDetailModel } from './types.ts'
import type {
  AssemblyHost,
  Feature,
  SimpleFeatureSerialized,
  TrackCatalog,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'
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

function isLinearGenomeView(view: {
  type: string
}): view is LinearGenomeViewModel {
  return view.type === 'LinearGenomeView'
}

// The panel the launch is anchored on: its assembly is the anchor's, its tracks
// carry over, and its visible window is what the dialog offers to clip to. A
// track's own context menu hands this widget the single LGV it lives in; a
// ribbon click hands over the outer LinearSyntenyView itself, with `level`
// saying which row produced the feature, and names no row without one. A
// circle's ribbon hands over a view with no linear row, so no anchor.
export function anchorRow({
  view,
  level,
}: SyntenyFeatureDetailModel): LinearGenomeViewModel | undefined {
  if ('views' in view) {
    return level === undefined ? undefined : view.views[level]
  }
  return isLinearGenomeView(view) ? view : undefined
}

// A view showing both genomes of an alignment, as the circle does, which says
// what a linear view of either genome opens with
interface BothGenomesView {
  id: string
  linearTracksFor: (assemblyName: string) => TrackInit[]
}

function showsBothGenomes(view: object): view is BothGenomesView {
  return 'linearTracksFor' in view
}

/**
 * What a launch from this widget anchors on: the linear row the feature was
 * drawn in, with its tracks and its visible window; or on the circle, the
 * feature's own genome, with the circle's tracks for it and for the mate's.
 */
export function launchAnchor(
  model: SyntenyFeatureDetailModel,
  host: AssemblyHost,
  feature: Feature,
) {
  const row = anchorRow(model)
  if (row) {
    return {
      viewId: row.id,
      assembly: row.assemblyNames[0],
      tracks: anchorPanelTracks(row.tracks),
      mateTracks: undefined,
      region: visibleSpanOnFeature(host, row, feature),
    }
  }
  const { view } = model
  if (!showsBothGenomes(view)) {
    return undefined
  }
  const own = feature.get('assemblyName') as string | undefined
  const assembly =
    own === undefined ? undefined : host.assemblyManager.get(own)?.name
  const mate = getMate(feature)
  return {
    viewId: view.id,
    assembly,
    tracks: assembly === undefined ? [] : view.linearTracksFor(assembly),
    mateTracks: mate
      ? { [mate.assemblyName]: view.linearTracksFor(mate.assemblyName) }
      : undefined,
    region: undefined,
  }
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
  const feature = new SimpleFeature(feat)
  const anchor = launchAnchor(model, session, feature)
  const mate = anchor
    ? openMateInLinearView({
        host: session,
        feature,
        viewId: anchor.viewId,
        region: anchor.region,
      })
    : undefined
  const launch =
    anchor && track
      ? pairwiseSyntenyLaunch({
          host: session,
          feature,
          anchorAssembly: anchor.assembly,
          anchorTracks: anchor.tracks,
          mateTracks: anchor.mateTracks,
          region: anchor.region,
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
  const allAssemblies =
    row && track
      ? allAssembliesLaunchItems({
          session,
          view: row,
          track,
          region: visibleSpanOnFeature(session, row, feature),
        })
      : []
  const canCenter = 'views' in view
  // No card at all rather than an empty one titled "Link to view". A synteny
  // track opened inside a plain LGV has no rows to center, and a mate whose
  // assembly the track does not declare cannot launch a view either — which
  // left the panel showing a heading over an empty list.
  if (!canCenter && !launch && !mate && allAssemblies.length === 0) {
    return null
  }
  return (
    <BaseCard title="Link to view">
      <ul>
        {canCenter ? (
          <li>
            <ActionLink
              onClick={() => {
                const problems = centerStackOnFeature({
                  view,
                  level,
                  feat,
                  assemblyManager: session.assemblyManager,
                })
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
        {allAssemblies.map(item =>
          'onClick' in item ? (
            <li key={`${item.label}`}>
              <ActionLink
                onClick={() => {
                  item.onClick()
                }}
              >
                {item.label}
              </ActionLink>
            </li>
          ) : null,
        )}
        {mate ? (
          <li>
            <ActionLink
              onClick={() => {
                mate.open().catch((e: unknown) => {
                  session.notifyError(`${e}`, e)
                })
              }}
            >
              {openMateLabel(mate.assemblyName)}
            </ActionLink>
          </li>
        ) : null}
      </ul>
    </BaseCard>
  )
})

export default LinkToSyntenyView
