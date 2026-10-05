import { lazy } from 'react'

import { addMultiTrackMenuItems } from '@jbrowse/core/ui/multiTrackMenuItems'
import {
  getDialogHost,
  getSession,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import {
  getConfAssemblyNamesOrNone,
  toTrackConfigEntry,
} from '@jbrowse/core/util/tracks'

import {
  addMultiRowTrack,
  stackKindOf,
} from '../MultiWiggleAddTrackWorkflow/util.ts'

import type { StackKind } from '../MultiWiggleAddTrackWorkflow/util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const ConfirmDialog = lazy(() => import('./ConfirmDialog.tsx'))

interface MakeTrackArg {
  name: string
  tracks: AnyTrackConfig[]
  kind: StackKind
}

// The two things this menu item reads off the track selector, structurally:
// importing the selector's own model type would make the plugin that owns the
// widget a dependency of this one, and it already depends on this one.
interface TrackSelectorSelf extends IStateTreeNode {
  view?: { launchTrack: (trackId: string) => Promise<unknown> }
  selection: AnyTrackConfig[]
}

function makeTrack({
  model,
  arg,
}: {
  model: TrackSelectorSelf
  arg: MakeTrackArg
}) {
  const { name, tracks, kind } = arg
  const session = getSession(model)
  if (isSessionWithAddSessionTrack(session)) {
    addMultiRowTrack({
      session,
      view: model.view,
      name,
      kind,
      // #region trackConfigEntry
      // `tracks` are the selection's track configs, mostly frozen entries
      // that omit a slot at its default, so each read supplies the default
      assemblyNames: [
        ...new Set(tracks.flatMap(c => getConfAssemblyNamesOrNone(c))),
      ],
      adapter: {
        subadapters: tracks.map(toTrackConfigEntry).map(c => ({
          ...(c.adapter as Record<string, unknown>),
          source: (c.name as string | undefined) ?? '',
        })),
      },
      // #endregion
    })
  }
}

// #region register
export default function CreateMultiWiggleExtensionF(pm: PluginManager) {
  addMultiTrackMenuItems(pm, ({ session, model }) => {
    const tracks = model.selection.filter(t => stackKindOf(t.type))
    const leftOut = model.selection.filter(t => !stackKindOf(t.type))
    // contributing nothing is `undefined`, not an empty array to spread into
    // someone else's — the accumulated items are not this callback's to see
    return isSessionWithAddSessionTrack(session) && tracks.length > 0
      ? {
          label: 'Create multi-row track...',
          onClick: () => {
            getDialogHost(model).queueDialog(handleClose => [
              ConfirmDialog,
              {
                tracks,
                leftOut,
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
      : undefined
  })
}
// #endregion
