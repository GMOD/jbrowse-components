import { lazy } from 'react'

import {
  fileLocationSlots,
  isConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { loadErrorHint } from '@jbrowse/core/ui/loadErrorHint'
import { blobFilesToReopen } from '@jbrowse/core/util/tracks'
import {
  isSessionModelWithConfigEditing,
  isTrackModel,
} from '@jbrowse/core/util/types'
import { isLiveModel } from '@jbrowse/display-ui'
import {
  findParent,
  hasParent,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import type { ErrorSource } from './chromeOverlaySlots.tsx'
import type { AbstractTrackModel } from '@jbrowse/core/util/types'

const TrackFilesDialog = lazy(() => import('./TrackFilesDialog.tsx'))

function containingTrack(model: unknown) {
  const track =
    isStateTreeNode(model) && hasParent(model)
      ? findParent(model, isTrackModel)
      : undefined
  return isTrackModel(track) ? track : undefined
}

function fileFixLabel(error: unknown, track: AbstractTrackModel) {
  return blobFilesToReopen(readConfObject(track.configuration, 'adapter'))
    .length
    ? 'Choose the file again...'
    : loadErrorHint(`${error}`) !== undefined
      ? 'Fix file location...'
      : undefined
}

/**
 * The error bar's file fix, offered where the track's file locations hold it:
 * an error `loadErrorHint` recognizes, or a file opened from this computer in
 * an earlier session that has to be chosen again. It opens a dialog of the
 * adapter's file locations, saved as the settings form saves them, and only
 * where a session offers track settings at all, which the embedded views do
 * not. Any other error keeps the bar it had.
 */
export function fileFixAction(model: ErrorSource) {
  const track = containingTrack(model)
  const session = track
    ? findParent(track, isSessionModelWithConfigEditing)
    : undefined
  const label = track ? fileFixLabel(model.error, track) : undefined
  return track &&
    label &&
    isSessionModelWithConfigEditing(session) &&
    session.getTrackActions
    ? {
        label,
        onClick: () => {
          const openSettings = () => {
            session.editConfiguration(track.configuration, {
              expandedDisplayId: model.configuration?.displayId,
            })
          }
          const adapter: unknown = track.configuration.adapter
          const slots = isConfigurationModel(adapter)
            ? fileLocationSlots(adapter)
            : []
          if (slots.length) {
            session.queueDialog(handleClose => [
              TrackFilesDialog,
              {
                trackName: readConfObject(track.configuration, 'name'),
                slots,
                onSave: () => {
                  if (isLiveModel(model)) {
                    model.reload()
                  }
                },
                onAllSettings: openSettings,
                handleClose,
              },
            ])
          } else {
            openSettings()
          }
        },
      }
    : undefined
}
