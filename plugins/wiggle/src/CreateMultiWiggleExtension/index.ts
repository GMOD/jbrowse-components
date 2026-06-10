import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'

import { addMultiWiggleTrack } from '../MultiWiggleAddTrackWorkflow/util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { HierarchicalTrackSelectorModel } from '@jbrowse/plugin-data-management'

const ConfirmDialog = lazy(() => import('./ConfirmDialog.tsx'))

interface MakeTrackArg {
  name: string
  tracks: AnyConfigurationModel[]
}

function makeTrack({
  model,
  arg,
}: {
  model: HierarchicalTrackSelectorModel
  arg: MakeTrackArg
}) {
  const { name, tracks } = arg
  const session = getSession(model)
  if (isSessionWithAddTracks(session)) {
    addMultiWiggleTrack({
      session,
      view: model.view,
      name,
      assemblyNames: [
        ...new Set(tracks.flatMap(c => readConfObject(c, 'assemblyNames'))),
      ],
      adapter: {
        subadapters: tracks.map(c => ({
          ...readConfObject(c, 'adapter'),
          source: readConfObject(c, 'name'),
        })),
      },
    })
  }
}

export default function CreateMultiWiggleExtensionF(pm: PluginManager) {
  pm.addToExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    (items, props) => {
      const { session } = props
      return [
        ...items,
        ...(isSessionWithAddTracks(session)
          ? [
              {
                label: 'Create multi-wiggle track',
                onClick: (model: HierarchicalTrackSelectorModel) => {
                  getSession(model).queueDialog(handleClose => [
                    ConfirmDialog,
                    {
                      tracks: model.selection,
                      onClose: (result?: MakeTrackArg) => {
                        if (result) {
                          makeTrack({ model, arg: result })
                        }
                        handleClose()
                      },
                    },
                  ])
                },
              },
            ]
          : []),
      ]
    },
  )
}
