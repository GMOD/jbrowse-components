import {
  addTracksFromWidget,
  getSession,
  isUriLocation,
  makeTrackId,
  pluralize,
} from '@jbrowse/core/util'
import { stripFileExtension } from '@jbrowse/core/util/tracks'

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
 * Add each preview row under the name it resolved to.
 *
 * Ids are minted here rather than with the preview rows: a timestamp held in
 * component state is pinned for the life of the mounted widget, so a second
 * submit (after one that failed partway, say) would re-mint the ids of the
 * tracks already added and publishTrackConf would silently hand back those.
 */
export async function submitBulkTracks({
  model,
  named,
}: {
  model: AddTrackModel
  named: NamedRow[]
}) {
  const timestamp = Date.now()
  await addTracksFromWidget({
    model,
    session: getSession(model),
    confs: named.map(({ row, name }, index) => ({
      ...row.conf,
      name,
      trackId: makeTrackId({ name, timestamp, index }),
    })),
  }).shown
}
