import {
  addAndShowTrack,
  fileToLocation,
  makeTrackId,
} from '@jbrowse/core/util'

import { getFilename } from '../util.ts'

import type { SessionWithAddSessionTrack } from '@jbrowse/core/util'

export type TrackItem = string | Record<string, unknown>

function lineSplit(val: string) {
  return val
    .split(/[\r\n]+/)
    .map(f => f.trim())
    .filter(Boolean)
}

export function parseItems(val: string): TrackItem[] {
  try {
    const parsed: unknown = JSON.parse(val)
    if (Array.isArray(parsed)) {
      return parsed as TrackItem[]
    }
    // A single JSON object is one subadapter config — wrap it rather than
    // letting it fall through to line-splitting, which would shred the JSON
    // text into junk track rows.
    if (typeof parsed === 'object' && parsed !== null) {
      return [parsed as Record<string, unknown>]
    }
  } catch {}
  return lineSplit(val)
}

// Mirror MultiWiggleAdapter's filename derivation so a source-less pasted
// subadapter shows (and later resolves to) the same basename the adapter would
// pick, rather than the bare 'unnamed' fallback.
function locationName(item: Record<string, unknown>) {
  const loc = item.bigWigLocation
  if (loc && typeof loc === 'object') {
    const l = loc as Record<string, unknown>
    const path =
      (typeof l.uri === 'string' ? l.uri : undefined) ??
      (typeof l.localPath === 'string' ? l.localPath : undefined)
    if (path) {
      return getFilename(path)
    }
  }
  return undefined
}

export function itemToName(item: TrackItem) {
  return typeof item === 'string'
    ? getFilename(item)
    : `${item.source ?? item.name ?? locationName(item) ?? 'unnamed'}`
}

// A bare URL with no explicit source is left source-less so the adapter derives
// the subtrack name from the filename (basename), matching the `bigWigs`
// shorthand. Only a user-supplied rename pins an explicit source.
export function urlToSubadapter(uri: string, source?: string) {
  return {
    type: 'BigWigAdapter',
    bigWigLocation: { uri },
    ...(source === undefined ? {} : { source }),
  }
}

// Pins an edited name as the subtrack `source`; an unedited item is left as it
// came, so a URL keeps the compact `bigWigs` form and the adapter derives the
// same name itself.
export function applyName(item: TrackItem, name: string): TrackItem {
  return name === itemToName(item)
    ? item
    : typeof item === 'string'
      ? urlToSubadapter(item, name)
      : { ...item, source: name }
}

// Strip the extension so a dropped file names its subtrack the same way a
// pasted URL with the same basename would (both derive from getFilename).
export function fileToTrackItem(file: File): TrackItem {
  return {
    type: 'BigWigAdapter',
    bigWigLocation: fileToLocation(file),
    source: getFilename(file.name),
  }
}

export function canSubmit({
  tracks,
  trackName,
  assembly,
}: {
  tracks: unknown[]
  trackName: string
  assembly: string | undefined
}) {
  return tracks.length > 0 && trackName.trim().length > 0 && !!assembly
}

export function buildAdapterPayload(items: TrackItem[]) {
  if (items.every(i => typeof i === 'string')) {
    return { bigWigs: items }
  }
  return {
    subadapters: items.map(i =>
      typeof i === 'string' ? urlToSubadapter(i) : i,
    ),
  }
}

/**
 * A MultiQuantitativeTrack config around a MultiWiggleAdapter. Shared between
 * the add-track workflow and the track-selector "Create multi-wiggle track"
 * extension, which add it two different ways — the workflow through the widget
 * (which also dismisses itself), the extension straight into its own view.
 */
export function buildMultiWiggleTrackConf({
  name,
  assemblyNames,
  adapter,
}: {
  name: string
  assemblyNames: string[]
  adapter: Record<string, unknown>
}) {
  return {
    trackId: makeTrackId({ name }),
    type: 'MultiQuantitativeTrack',
    name,
    assemblyNames,
    adapter: {
      type: 'MultiWiggleAdapter',
      ...adapter,
    },
  }
}

export function addMultiWiggleTrack({
  session,
  view,
  ...rest
}: {
  session: SessionWithAddSessionTrack
  view?: { launchTrack: (trackId: string) => Promise<unknown> }
  name: string
  assemblyNames: string[]
  adapter: Record<string, unknown>
}) {
  addAndShowTrack(session, buildMultiWiggleTrackConf(rest), view)
}
