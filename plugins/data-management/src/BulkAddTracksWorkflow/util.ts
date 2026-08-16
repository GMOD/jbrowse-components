import {
  containerDisplaysAssembly,
  finishAddTrack,
  getSession,
  isSessionWithAddTracks,
  isUriLocation,
  makeTrackId,
  pluralize,
} from '@jbrowse/core/util'
import { stripFileExtension } from '@jbrowse/core/util/tracks'
import { transaction } from 'mobx'

import {
  isBlockedHttpUrl,
  isFtpUrl,
  isRelativeUrl,
} from '../AddTrackWidget/urlWarnings.ts'

import type { AddTrackModel } from '../AddTrackWidget/model.ts'
import type { TrackConfRow } from './buildConfigs.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

export interface NamedRow {
  row: TrackConfRow
  /** the name the row is added under: the user's edit if there is one */
  name: string
  /** the name with no user edit — what an emptied name cell falls back to */
  autoName: string
}

/**
 * Pairs every row with the name it will be added under. An explicit user edit
 * always wins. Stripping is skipped for rows whose stripped name would collide
 * with another row's (`a.bam` and `a.vcf.gz` both stripping to `a` would leave
 * two indistinguishable tracks in the selector) — those keep their extension,
 * which is the thing that tells them apart.
 *
 * Collisions are counted over stripped names only, ignoring user renames, so
 * the toggle stays a pure function of the file list: typing a name in one row
 * never changes how a different row is displayed.
 *
 * Resolve once over ALL rows and filter afterwards, never per-subset — counting
 * collisions over just the ok rows would strip a name on submit that the
 * preview table showed un-stripped.
 */
export function resolveTrackNames({
  rows,
  customNames,
  stripExtensions,
}: {
  rows: TrackConfRow[]
  customNames: Record<string, string>
  stripExtensions: boolean
}): NamedRow[] {
  const entries = rows.map(row => ({
    row,
    stripped: stripFileExtension(row.name),
  }))
  const counts = new Map<string, number>()
  for (const { stripped } of entries) {
    counts.set(stripped, (counts.get(stripped) ?? 0) + 1)
  }
  return entries.map(({ row, stripped }) => {
    const autoName =
      stripExtensions && counts.get(stripped) === 1 ? stripped : row.name
    return {
      row,
      autoName,
      name: customNames[row.id] ?? autoName,
    }
  })
}

/**
 * The custom-name map with any rename of `id` dropped, so the row falls back to
 * its automatic name. Returns the map unchanged when there was no rename, so a
 * no-op doesn't re-render.
 */
export function withoutName(
  customNames: Record<string, string>,
  id: string,
): Record<string, string> {
  if (!(id in customNames)) {
    return customNames
  }
  const next = { ...customNames }
  delete next[id]
  return next
}

/**
 * The custom-name map after a name cell is committed. A commit that leaves the
 * name at (or clears it back to) the automatic one records nothing: the grid
 * fires `processRowUpdate` on every commit, including one where nothing was
 * typed, and storing that as a rename would silently opt the row out of the
 * strip-extensions toggle. Returns the map unchanged when there is nothing to
 * record, so an inert commit doesn't re-render.
 */
export function withEditedName({
  customNames,
  id,
  name,
  autoName,
}: {
  customNames: Record<string, string>
  id: string
  name: string
  autoName: string
}): Record<string, string> {
  const trimmed = name.trim()
  if (!trimmed || trimmed === autoName) {
    return withoutName(customNames, id)
  }
  return customNames[id] === trimmed
    ? customNames
    : { ...customNames, [id]: trimmed }
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
      `${ftp} ${pluralize(ftp, 'URL uses', 'URLs use')} the ftp protocol, which JBrowse cannot access`,
    )
  }
  if (relative > 0) {
    warnings.push(
      `${relative} ${pluralize(relative, 'URL is', 'URLs are')} relative; provide an absolute URL (e.g. https://) unless a relative URL is intended`,
    )
  }
  if (http > 0) {
    warnings.push(
      `${http} http:// ${pluralize(http, 'URL')} may be blocked because this page is served over https`,
    )
  }
  return warnings
}

/**
 * Add each preview row as a session track under the name it resolved to, then
 * show the new tracks if the open view is on the chosen assembly and close the
 * widget.
 */
export function submitBulkTracks({
  model,
  named,
  assembly,
}: {
  model: AddTrackModel
  named: NamedRow[]
  assembly: string
}) {
  const session = getSession(model)
  if (!isSessionWithAddTracks(session)) {
    // the other two submit paths (doSubmit, doPasteConfigSubmit) throw the same
    // way; the button catches it and shows an error rather than no-oping
    throw new Error("Can't add tracks to this session")
  }
  const { trackContainer } = model
  const showInView = containerDisplaysAssembly(trackContainer, [assembly])
  // Ids are minted here rather than with the preview rows: the preview is
  // rebuilt on every keystroke, but a timestamp held in component state is
  // pinned for the life of the mounted widget, so a second submit (after one
  // that failed partway, say) would re-mint the ids of the tracks already
  // added and addTrackConf would silently hand back those instead.
  const timestamp = Date.now()
  let added = 0
  // adding a batch one track at a time otherwise re-renders the track
  // selector once per file, which is the whole point of this workflow
  transaction(() => {
    for (const [index, { row, name }] of named.entries()) {
      const conf = {
        ...row.conf,
        name,
        trackId: makeTrackId({ name, timestamp, index }),
      }
      // addTrackConf returns undefined for an invalid config, having already
      // surfaced its own error; showing it would only add a second, vaguer
      // "could not resolve identifier" snackbar on top (see
      // doPasteConfigSubmit, which makes the same check)
      if (session.addTrackConf(conf)) {
        added++
        if (showInView) {
          trackContainer?.showTrack(conf.trackId)
        }
      }
    }
    // Only on a batch that landed something. Finishing dismisses the widget and
    // clears the form, so doing it when every config was rejected would throw
    // away the list the user assembled — the expensive part of this workflow —
    // behind the snackbars explaining why it failed, with nothing to retry from.
    if (added > 0) {
      finishAddTrack(model, session)
    }
  })
  if (added > 0 && !showInView) {
    session.notify(
      `Added ${added} ${pluralize(added, 'track')} to the session that ${pluralize(added, 'was', 'were')} not displayed because assembly "${assembly}" is not open in this view`,
      'warning',
    )
  }
}
