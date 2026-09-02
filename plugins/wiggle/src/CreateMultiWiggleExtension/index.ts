import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { addMultiTrackMenuItems } from '@jbrowse/core/ui/multiTrackMenuItems'
import {
  getDialogHost,
  getSession,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'

import { addMultiWiggleTrack } from '../MultiWiggleAddTrackWorkflow/util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const ConfirmDialog = lazy(() => import('./ConfirmDialog.tsx'))

interface MakeTrackArg {
  name: string
  tracks: AnyConfigurationModel[]
}

// The two things this menu item reads off the track selector, structurally:
// importing the selector's own model type would make the plugin that owns the
// widget a dependency of this one, and it already depends on this one.
interface TrackSelectorSelf extends IStateTreeNode {
  view?: { launchTrack: (trackId: string) => Promise<unknown> }
  selection: AnyConfigurationModel[]
}

function makeTrack({
  model,
  arg,
}: {
  model: TrackSelectorSelf
  arg: MakeTrackArg
}) {
  const { name, tracks } = arg
  const session = getSession(model)
  if (isSessionWithAddSessionTrack(session)) {
    addMultiWiggleTrack({
      session,
      view: model.view,
      name,
      // #region readConfObject
      // `tracks` are the selected track *configs*, not track models, so these
      // are readConfObject reads rather than getConf ones
      assemblyNames: [
        ...new Set(tracks.flatMap(c => readConfObject(c, 'assemblyNames'))),
      ],
      adapter: {
        subadapters: tracks.map(c => ({
          ...readConfObject(c, 'adapter'),
          source: readConfObject(c, 'name'),
        })),
      },
      // #endregion
    })
  }
}

// #region register
export default function CreateMultiWiggleExtensionF(pm: PluginManager) {
  addMultiTrackMenuItems(pm, ({ session }) =>
    // contributing nothing is `undefined`, not an empty array to spread into
    // someone else's — the accumulated items are not this callback's to see
    isSessionWithAddSessionTrack(session)
      ? {
          label: 'Create multi-wiggle track...',
          onClick: (model: TrackSelectorSelf) => {
            getDialogHost(model).queueDialog(handleClose => [
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
        }
      : undefined,
  )
}
// #endregion
