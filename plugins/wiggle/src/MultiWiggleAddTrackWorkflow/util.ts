export type TrackItem = string | Record<string, unknown>

export function lineSplit(val: string) {
  return val
    .split(/\n|\r\n|\r/)
    .map(f => f.trim())
    .filter(Boolean)
}

export function parseItems(val: string): TrackItem[] {
  try {
    const parsed: unknown = JSON.parse(val)
    if (Array.isArray(parsed)) {
      return parsed as TrackItem[]
    }
  } catch (e) {}
  return lineSplit(val)
}

export function itemToName(item: TrackItem) {
  if (typeof item === 'string') {
    return item
  }
  return `${item.source ?? item.name ?? 'unnamed'}`
}

export function urlToSubadapter(uri: string) {
  return {
    type: 'BigWigAdapter',
    bigWigLocation: { uri, locationType: 'UriLocation' },
    source: uri,
  }
}

export function buildAdapterPayload(items: TrackItem[]) {
  if (items.every(i => typeof i === 'string')) {
    return { bigWigs: items as string[] }
  }
  return {
    subadapters: items.map(i =>
      typeof i === 'string' ? urlToSubadapter(i) : i,
    ),
  }
}
