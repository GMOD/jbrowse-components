// A figure's live link is `?config=…&session=spec-<url-encoded JSON>`. Decoding
// it recovers the exact session spec that produced the screenshot, so anything
// derived from it (the JSON we show, the click-path we describe) is generated
// from the same source of truth as the image and cannot drift from it.

export interface SpecTrack {
  trackId: string
  [field: string]: unknown
}

export type SpecTrackEntry = string | SpecTrack

export interface SpecView {
  type?: string
  assembly?: string
  loc?: string
  // a synteny view nests these per level: (SpecTrackEntry | SpecTrackEntry[])[]
  tracks?: (SpecTrackEntry | SpecTrackEntry[])[]
  views?: SpecView[]
  [field: string]: unknown
}

export interface SessionSpec {
  views?: SpecView[]
  sessionTracks?: SpecTrack[]
  [field: string]: unknown
}

export interface DecodedSpec {
  // origin + path of the live instance, e.g. https://jbrowse.org/code/jb2/main/
  base: string
  // the `config=` value as authored: a repo-relative test_data path or an
  // absolute URL to a hosted config
  config: string
  spec: SessionSpec
}

export function decodeSpecUrl(url: string): DecodedSpec | undefined {
  const qIndex = url.indexOf('?')
  if (qIndex === -1) {
    return undefined
  }
  const params = new URLSearchParams(url.slice(qIndex + 1))
  const session = params.get('session')
  if (!session?.startsWith('spec-')) {
    return undefined
  }
  try {
    return {
      base: url.slice(0, qIndex),
      config: params.get('config') ?? '',
      spec: JSON.parse(session.slice('spec-'.length)) as SessionSpec,
    }
  } catch {
    // a non-spec session (share link, encoded snapshot) has nothing to explain
    return undefined
  }
}

export function specTrackId(entry: SpecTrackEntry): string {
  return typeof entry === 'string' ? entry : entry.trackId
}

// The settings a track entry carries beyond its identity — every one of these is
// a UI control the reader would otherwise have to find by hand.
export function specTrackSettings(entry: SpecTrackEntry): [string, unknown][] {
  return typeof entry === 'string'
    ? []
    : Object.entries(entry).filter(([field]) => field !== 'trackId')
}

// A synteny view nests its tracks one level deeper — `tracks: [[trackId]]`, one
// row per pair of adjacent views — so flatten before treating entries as tracks
// (indexing an array as an object otherwise yields "0" as a field name).
export function specTracks(view: SpecView): SpecTrackEntry[] {
  return (view.tracks ?? []).flatMap(entry =>
    Array.isArray(entry) ? entry : [entry],
  )
}
