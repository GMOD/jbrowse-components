import { lazy } from 'react'

import { ActionLink } from '@jbrowse/core/ui'
import {
  SimpleFeature,
  assembleLocString,
  getSession,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { SyntenyFeatureDetailModel } from './types.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// lazies
const LaunchSyntenyViewDialog = lazy(
  () => import('../LGVSyntenyDisplay/components/LaunchSyntenyViewDialog.tsx'),
)

const LinkToSyntenyView = observer(function LinkToSyntenyView({
  model,
  feat,
}: {
  model: SyntenyFeatureDetailModel
  feat: SimpleFeatureSerialized
}) {
  const { view, level, trackId } = model
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
                const f1 = feat
                const f2 = feat.mate as SimpleFeatureSerialized
                const r1 = f1.assemblyName as string
                const r2 = f2.assemblyName as string
                const v1 = views.find(view => view.assemblyNames[0] === r1)
                const v2 = views.find(view => view.assemblyNames[0] === r2)
                if (!v1 || !v2) {
                  getSession(model).notify(
                    [
                      !v1
                        ? `Unable to find ${assembleLocString(f1)} in synteny view`
                        : '',
                      !v2
                        ? `Unable to find ${assembleLocString(f2)} in synteny view`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ... '),
                  )
                }
                v1?.navTo(f1, 0.2)
                v2?.navTo(f2, 0.2)
              }
            }}
          >
            Center view on this feature
          </ActionLink>
        </li>
      ) : null}
      <li>
        <ActionLink
          onClick={() => {
            const feature = new SimpleFeature(feat)
            const session = getSession(model)
            session.queueDialog(handleClose => [
              LaunchSyntenyViewDialog,
              {
                session,
                feature,
                trackId,
                handleClose,
              },
            ])
          }}
        >
          Launch new linear synteny view on this feature
        </ActionLink>
      </li>
    </ul>
  )
})

export default LinkToSyntenyView
