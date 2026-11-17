import { readConfObject } from '@jbrowse/core/configuration'
import { loadErrorHint } from '@jbrowse/core/ui/loadErrorHint'
import { blobFilesToReopen } from '@jbrowse/core/util/tracks'
import {
  isSessionModelWithConfigEditing,
  isTrackModel,
} from '@jbrowse/core/util/types'
import {
  findParent,
  hasParent,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import type { ErrorSource } from './chromeOverlaySlots.tsx'
import type { AbstractTrackModel } from '@jbrowse/core/util/types'

function containingTrack(model: unknown) {
  const track =
    isStateTreeNode(model) && hasParent(model)
      ? findParent(model, isTrackModel)
      : undefined
  return isTrackModel(track) ? track : undefined
}

/**
 * The error bar's "Edit track": opens the same settings as the track menu's
 * Track actions > Settings, so it is offered only where that row is — a
 * session with track actions and a configuration editor, which the embedded
 * views are not. And only when those settings hold the fix: an error
 * `loadErrorHint` recognizes, or a file opened from this computer in an
 * earlier session that has to be chosen again. Any other error keeps the bar
 * it had.
 */
function settingsHoldTheFix(error: unknown, track: AbstractTrackModel) {
  return (
    loadErrorHint(`${error}`) !== undefined ||
    blobFilesToReopen(readConfObject(track.configuration, 'adapter')).length > 0
  )
}

export function editTrackAction(model: ErrorSource) {
  const track = containingTrack(model)
  const session = track
    ? findParent(track, isSessionModelWithConfigEditing)
    : undefined
  return track &&
    isSessionModelWithConfigEditing(session) &&
    session.getTrackActions &&
    settingsHoldTheFix(model.error, track)
    ? () => {
        session.editConfiguration(track.configuration, {
          expandedDisplayId: model.configuration?.displayId,
        })
      }
    : undefined
}
