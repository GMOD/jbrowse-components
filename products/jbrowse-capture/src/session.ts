/**
 * The decoded `session=` value that opens a session spec. Hand it to
 * `URLSearchParams`, which encodes it once itself.
 */
export function sessionSpecParam(session: object): string {
  return `spec-${JSON.stringify(session)}`
}

/**
 * The `session=` value pre-encoded, for a query string built by hand. Passed
 * through `URLSearchParams` as well, it is encoded twice and the app fails to
 * parse it.
 */
export function encodeSessionSpec(session: object): string {
  return encodeURIComponent(sessionSpecParam(session))
}

/**
 * The `session=` value that opens a session saved with "Export session...".
 * Takes the exported `{ session: {...} }` document or the snapshot inside it.
 */
export function savedSessionParam(session: object): string {
  return `json-${JSON.stringify({ session: savedSnapshot(session) })}`
}

/** The snapshot inside an exported session document, or the snapshot itself. */
export function savedSnapshot(session: object): object {
  const inner = (session as { session?: unknown }).session
  return typeof inner === 'object' && inner !== null ? inner : session
}

// a spec names a track by id or `{trackId, displaySnapshot}`; a saved snapshot
// by `{configuration}`, which is the trackId, or a session track's whole config
type TrackEntry =
  | string
  | { trackId?: string; configuration?: string | { trackId?: string } }

interface SpecShape {
  views?: {
    assembly?: string | string[]
    displayedRegions?: { assemblyName?: string }[]
    assemblyNames?: string[]
    // a synteny spec may nest one list per level
    tracks?: (TrackEntry | string[])[]
    levels?: { tracks?: TrackEntry[] }[]
    views?: SpecShape['views']
  }[]
}

/**
 * The assembly the first view of a session spec or saved snapshot opens, if
 * it names one.
 */
export function assemblyFromSession(session: object): string | undefined {
  const find = (views: SpecShape['views']): string | undefined => {
    for (const view of views ?? []) {
      const found =
        [view.assembly ?? []].flat()[0] ??
        view.displayedRegions?.[0]?.assemblyName ??
        view.assemblyNames?.[0] ??
        find(view.views)
      if (found) {
        return found
      }
    }
    return undefined
  }
  return find((session as SpecShape).views)
}

/**
 * Every trackId a session spec or saved snapshot opens, nested views
 * included.
 */
export function trackIdsFromSession(session: object): string[] {
  const idOf = (t: TrackEntry) =>
    typeof t === 'string'
      ? t
      : (t.trackId ??
        (typeof t.configuration === 'string'
          ? t.configuration
          : t.configuration?.trackId))
  const idsOf = (tracks: TrackEntry[] = []) =>
    tracks.map(idOf).filter(id => id !== undefined)
  const collect = (views: SpecShape['views']): string[] =>
    (views ?? []).flatMap(view => [
      ...idsOf(view.tracks?.flat()),
      ...(view.levels ?? []).flatMap(l => idsOf(l.tracks)),
      ...collect(view.views),
    ])
  return collect((session as SpecShape).views)
}

/**
 * `?config=…&session=…&sessionName=…`, for a caller that has an origin but no
 * JBrowse instance URL to hand `jbrowseUrl`.
 */
export function sessionSpecQuery({
  config,
  session,
  sessionName = 'Screenshot',
}: {
  config: string
  session: object
  sessionName?: string
}): string {
  return `?${new URLSearchParams({
    config,
    session: sessionSpecParam(session),
    sessionName,
  })}`
}
