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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The settings a track entry carries beyond its identity — every one of these is
// a UI control the reader would otherwise have to find by hand.
//
// A spec may write those settings inline on the track entry or nested under
// `displaySnapshot`; both forms reach the same display. Flattening the nested
// one here mirrors `normalizeTrackInit` in core (packages/core/src/util/
// tracks.ts), down to its precedence — an explicit `displaySnapshot` key wins
// over an inline key of the same name. Without this the whole snapshot is one
// opaque leaf, so every setting inside it reads as a gap even when the field
// already has a click-path, and the two spellings of one figure describe
// themselves differently.
export function specTrackSettings(entry: SpecTrackEntry): [string, unknown][] {
  if (typeof entry === 'string') {
    return []
  }
  const { trackId, displaySnapshot, ...inline } = entry
  return Object.entries({
    ...inline,
    ...(isPlainObject(displaySnapshot) ? displaySnapshot : {}),
  })
}

// A synteny view nests its tracks one level deeper — `tracks: [[trackId]]`, one
// row per pair of adjacent views — so flatten before treating entries as tracks
// (indexing an array as an object otherwise yields "0" as a field name).
export function specTracks(view: SpecView): SpecTrackEntry[] {
  return (view.tracks ?? []).flatMap(entry =>
    Array.isArray(entry) ? entry : [entry],
  )
}
