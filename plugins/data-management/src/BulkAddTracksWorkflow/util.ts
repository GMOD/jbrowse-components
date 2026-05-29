import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'

import type { TrackConfRow } from './buildConfigs.ts'
import type { AddTrackModel } from '../AddTrackWidget/model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

export type InputMode = 'remote' | 'local'

/**
 * Parse a textarea of one-URL-per-line into remote file locations, ignoring
 * blank lines and surrounding whitespace.
 */
export function parseUrlList(text: string): FileLocation[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(uri => ({ uri, locationType: 'UriLocation' }))
}

/**
 * Add each preview row as a session track, applying any user-edited name, then
 * show the new tracks if the open view is on the chosen assembly and close the
 * widget.
 */
export function submitBulkTracks({
  model,
  rows,
  customNames,
  assembly,
}: {
  model: AddTrackModel
  rows: TrackConfRow[]
  customNames: Record<string, string>
  assembly: string
}) {
  const session = getSession(model)
  if (isSessionWithAddTracks(session)) {
    const showInView = model.view?.assemblyNames?.includes(assembly)
    for (const row of rows) {
      const conf = { ...row.conf, name: customNames[row.id] ?? row.name }
      session.addTrackConf(conf)
      if (showInView) {
        model.view?.showTrack(conf.trackId)
      }
    }
    model.clearData()
    if (isSessionModelWithWidgets(session)) {
      session.hideWidget(model)
    }
  }
}
