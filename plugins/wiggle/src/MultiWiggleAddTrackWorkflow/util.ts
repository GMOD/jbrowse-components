import {
  addAndShowTrack,
  fileToLocation,
  makeTrackId,
} from '@jbrowse/core/util'

import { getFilename } from '../util.ts'

import type { SessionWithAddTracks } from '@jbrowse/core/util'

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
  } catch {}
  return lineSplit(val)
}

export function itemToName(item: TrackItem) {
  if (typeof item === 'string') {
    return item
  }
  return `${item.source ?? item.name ?? 'unnamed'}`
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

/**
 * Pin a (possibly user-edited) display name as the subtrack `source`. A renamed
 * URL string is promoted to a BigWigAdapter object so the new name survives;
 * an unchanged URL stays a bare string to preserve the compact `bigWigs` form.
 */
export function applyName(item: TrackItem, name: string): TrackItem {
  if (typeof item === 'string') {
    return name === item ? item : urlToSubadapter(item, name)
  } else {
    return { ...item, source: name }
  }
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
 * Shared between the add-track workflow and the track-selector "Create
 * multi-wiggle track" extension: builds a MultiQuantitativeTrack config around a
 * MultiWiggleAdapter and shows it in the target view.
 */
export function addMultiWiggleTrack({
  session,
  view,
  name,
  assemblyNames,
  adapter,
}: {
  session: SessionWithAddTracks
  view?: { showTrack: (trackId: string) => void }
  name: string
  assemblyNames: string[]
  adapter: Record<string, unknown>
}) {
  addAndShowTrack(
    session,
    {
      trackId: makeTrackId({ name }),
      type: 'MultiQuantitativeTrack',
      name,
      assemblyNames,
      adapter: {
        type: 'MultiWiggleAdapter',
        ...adapter,
      },
    },
    view,
  )
}
