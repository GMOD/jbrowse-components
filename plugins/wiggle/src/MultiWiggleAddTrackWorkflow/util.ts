export type TrackItem = string | Record<string, unknown>

export function lineSplit(val: string) {
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

export function urlToSubadapter(uri: string, source = uri) {
  return {
    type: 'BigWigAdapter',
    bigWigLocation: { uri, locationType: 'UriLocation' },
    source,
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

export function makeTrackId(trackName: string, adminMode: boolean) {
  const slug = trackName.trim().toLowerCase().replaceAll(' ', '_')
  return `${slug}-${Date.now()}${adminMode ? '' : '-sessionTrack'}`
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
