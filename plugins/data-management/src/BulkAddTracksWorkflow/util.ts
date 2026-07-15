import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  isUriLocation,
} from '@jbrowse/core/util'

import {
  isBlockedHttpUrl,
  isFtpUrl,
  isRelativeUrl,
} from '../AddTrackWidget/urlWarnings.ts'

import type { TrackConfRow } from './buildConfigs.ts'
import type { AddTrackModel } from '../AddTrackWidget/model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

export type InputMode = 'remote' | 'local'

/** Pick the singular or plural wording for a count (1 is singular). */
export function plural(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural
}

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
 * Aggregate the same URL-loadability warnings the single-track workflow shows
 * (ftp, relative, http-on-https) across a whole batch of pasted locations.
 */
export function locationWarnings(locations: FileLocation[]): string[] {
  const uris = locations.filter(isUriLocation).map(loc => loc.uri)
  const ftp = uris.filter(isFtpUrl).length
  const relative = uris.filter(isRelativeUrl).length
  const http = uris.filter(isBlockedHttpUrl).length
  const warnings: string[] = []
  if (ftp > 0) {
    warnings.push(
      `${ftp} ${plural(ftp, 'URL uses', 'URLs use')} the ftp protocol, which JBrowse cannot access`,
    )
  }
  if (relative > 0) {
    warnings.push(
      `${relative} ${plural(relative, 'URL is', 'URLs are')} relative; provide an absolute URL (e.g. https://) unless a relative URL is intended`,
    )
  }
  if (http > 0) {
    warnings.push(
      `${http} http:// ${plural(http, 'URL', 'URLs')} may be blocked because this page is served over https`,
    )
  }
  return warnings
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
    if (!showInView) {
      session.notify(
        `Tracks added but not shown: the current view is not on assembly "${assembly}"`,
        'warning',
      )
    }
    model.clearData()
    if (isSessionModelWithWidgets(session)) {
      session.hideWidget(model)
    }
  }
}
