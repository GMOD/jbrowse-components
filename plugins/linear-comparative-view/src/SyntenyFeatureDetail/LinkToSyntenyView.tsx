import { lazy } from 'react'

import {
  SimpleFeature,
  assembleLocString,
  getSession,
} from '@jbrowse/core/util'
import { Link } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { SyntenyFeatureDetailModel } from './types'

// lazies
const LaunchSyntenyViewDialog = lazy(
  () => import('../LGVSyntenyDisplay/components/LaunchSyntenyViewDialog'),
)

const LinkToSyntenyView = observer(function ({
  model,
}: {
  model: SyntenyFeatureDetailModel
}) {
  const { featureData, view, level, trackId } = model
  return (
    <ul>
      {view.type === 'LinearSyntenyView' ? (
        <li>
          <Link
            href="#"
            onClick={event => {
              event.preventDefault()
              const { views } = view as LinearSyntenyViewModel
              if (level !== undefined) {
                // level is "pre-known", and stored in the SyntenyFeatureWidget
                // model state e.g. when clicking on a feature from a
                // LinearSyntenyRendering
                views[level]?.navTo(featureData)
                views[level + 1]?.navTo(
                  featureData.mate as SimpleFeatureSerialized,
                )
              } else {
                // best effort to find the right level. this is triggered for
                // example if a user clicks on a feature in a LGVSyntenyDisplay
                // in an existing LinearSyntenyView, there is no real proper
                // level "pre-known" to this situation
                const f1 = featureData
                const f2 = featureData.mate as SimpleFeatureSerialized
                const r1 = f1.assemblyName as string
                const r2 = f2.assemblyName as string
                const v1 = views.find(view => view.assemblyNames[0] === r1)
                const v2 = views.find(view => view.assemblyNames[0] === r2)
                if (!v1 || !v2) {
                  getSession(model).notify(
                    [
                      v1
                        ? `Unable to find ${assembleLocString(f1)} in synteny view`
                        : '',
                      v2
                        ? `Unable to find ${assembleLocString(f2)} in synteny view`
                        : '',
                    ].join(' ... '),
                  )
                }
                v1?.navTo(f1)
                v2?.navTo(f2)
              }
            }}
          >
            Center view on this feature
          </Link>
        </li>
      ) : null}
      <li>
        <Link
          href="#"
          onClick={event => {
            event.preventDefault()
            const feature = new SimpleFeature(featureData)
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
        </Link>
      </li>
    </ul>
  )
})

export default LinkToSyntenyView
