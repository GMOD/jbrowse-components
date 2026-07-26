import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { ActionLink } from '@jbrowse/core/ui'
import {
  SimpleFeature,
  assembleLocString,
  getSession,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/buildSyntenyViewSpec.ts'
import { getMate } from '../syntenyMate.ts'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { SyntenyFeatureDetailModel } from './types.ts'
import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

// lazies
const LaunchSyntenyViewDialog = lazy(
  () => import('../LaunchSyntenyView/LaunchSyntenyViewDialog.tsx'),
)

// The launched view needs the track back, so its id has to resolve to a track
// config we can read `assemblyNames` off — the same gate the LGV synteny
// right-click menu applies. Without it, a one-vs-all mate that is only a PanSN
// sample label (no declared assembly) opens a synteny view that can resolve
// nothing and lands on the import form with an error.
function findTrackAssemblyNames(
  session: AbstractSessionModel,
  trackId: string | undefined,
) {
  const track = session.tracks.find(
    t => readConfObject(t, 'trackId') === trackId,
  )
  return track
    ? (readConfObject(track, 'assemblyNames') as string[] | undefined)
    : undefined
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
  const anchorAssembly = feature.get('assemblyName')
  const trackAssemblyNames = findTrackAssemblyNames(session, trackId)
  const canLaunch =
    trackId !== undefined &&
    typeof anchorAssembly === 'string' &&
    trackAssemblyNames !== undefined &&
    canLaunchSyntenyForMate(trackAssemblyNames, mate?.assemblyName)
  return (
    <ul>
      {view.type === 'LinearSyntenyView' ? (
        <li>
          <ActionLink
            onClick={() => {
              const { views } = view as LinearSyntenyViewModel
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
