import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { HierarchicalTrackSelectorModel } from '@jbrowse/plugin-data-management'

// lazies
const ConfirmDialog = lazy(() => import('./ConfirmDialog'))

function makeTrack({
  model,
  arg,
}: {
  model: HierarchicalTrackSelectorModel
  arg: {
    name: string
  }
}) {
  const tracks = model.selection
  const trackIds = tracks.map(c => readConfObject(c, 'name'))
  const subadapters = tracks
    .map(c => readConfObject(c, 'adapter'))
    .map((c, idx) => ({ ...c, source: trackIds[idx] }))
  const now = Date.now()
  const trackId = `multitrack-${now}-sessionTrack`

  const session = getSession(model)
  if (isSessionWithAddTracks(session)) {
    session.addTrackConf({
      type: 'MultiQuantitativeTrack',
      trackId,
      name: arg.name,
      assemblyNames: [
        ...new Set(tracks.flatMap(c => readConfObject(c, 'assemblyNames'))),
      ],
      adapter: {
        type: 'MultiWiggleAdapter',
        subadapters,
      },
    })
    model.view.showTrack(trackId)
  }
}

export default function CreateMultiWiggleExtensionF(pm: PluginManager) {
  pm.addToExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    (items: unknown[], props: Record<string, unknown>) => {
      const { session } = props
      return [
        ...items,
        ...(isSessionWithAddTracks(session)
          ? [
              {
                label: 'Create multi-wiggle track',
                onClick: (model: HierarchicalTrackSelectorModel) => {
                  const tracks = model.selection

                  getSession(model).queueDialog(handleClose => [
                    ConfirmDialog,
                    {
                      tracks,
                      onClose: (arg: boolean, arg1?: { name: string }) => {
                        if (arg && arg1) {
                          makeTrack({ model, arg: arg1 })
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
