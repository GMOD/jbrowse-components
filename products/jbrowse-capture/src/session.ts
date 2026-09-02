// The DECODED value of the `session=` query param that jbrowse-web reads to open
// a declarative session without a saved-session backend: a `spec-` prefix plus
// the session JSON. This is what the app sees after the query string is parsed,
// so it is the right thing to hand to `URLSearchParams.set`, which does its own
// encoding.
export function sessionSpecParam(session: object): string {
  return `spec-${JSON.stringify(session)}`
}

// The same value pre-encoded, for callers that concatenate a query string by
// hand rather than going through URL. Passing THIS to `URLSearchParams.set`
// encodes it a second time, and the app then decodes once and parses `%7B…` as
// JSON — so pick one path and stay on it. Shared so the runner and screenshot
// generator can't drift on the encoding.
export function encodeSessionSpec(session: object): string {
  return encodeURIComponent(sessionSpecParam(session))
}

type TrackEntry = string | { trackId?: string }

interface SpecShape {
  views?: {
    assembly?: string
    // a synteny spec's `tracks` may be nested — one string[] per level (the
    // gap between adjacent rows), the shape normalizeTrackLevels accepts
    tracks?: (TrackEntry | string[])[]
    // the restructured snapshot spelling of the same thing, for a session
    // saved from a running view rather than written as a spec
    levels?: { tracks?: TrackEntry[] }[]
    views?: SpecShape['views']
  }[]
}

/**
 * The assembly a session spec's first view opens, if it names one.
 *
 * The session gate needs this because a spec can be loaded against any config —
 * `--hub hg38 --session spec.json` where the spec opens a different assembly is
 * legitimate, and defaulting the expectation to the hub name would fail a
 * perfectly good capture.
 */
export function assemblyFromSession(session: object): string | undefined {
  const find = (views: SpecShape['views']): string | undefined => {
    for (const view of views ?? []) {
      const found = view.assembly ?? find(view.views)
      if (found) {
        return found
      }
    }
    return undefined
  }
  return find((session as SpecShape).views)
}

/**
 * Every trackId a session spec asks a view to open, including nested views (a
 * synteny or breakpoint-split spec puts its LGVs one level down).
 *
 * Used as the session gate's expectation: it is what turns "the browser loaded"
 * into "the tracks I named are open", and a spec is the one input where the
 * caller has not spelled those ids out separately.
 */
export function trackIdsFromSession(session: object): string[] {
  // an entry may be a bare id or `{trackId, displaySnapshot}`; an object
  // without a trackId is malformed rather than a track to expect, so it drops
  // out here instead of gating on undefined
  const idsOf = (tracks: TrackEntry[] | undefined): string[] =>
    (tracks ?? [])
      .map(t => (typeof t === 'string' ? t : t.trackId))
      .filter(id => id !== undefined)
  const collect = (views: SpecShape['views']): string[] =>
    (views ?? []).flatMap(view => [
      // a nested entry is a synteny spec's per-level list; these used to be
      // filtered out as malformed, so a synteny --session gated on nothing
      ...(view.tracks ?? []).flatMap(t =>
        Array.isArray(t) ? idsOf(t) : idsOf([t]),
      ),
      ...(view.levels ?? []).flatMap(l => idsOf(l.tracks)),
      ...collect(view.views),
    ])
  return collect((session as SpecShape).views)
}

// Full `?config=…&session=…&sessionName=…` query string. `config` is inserted
// as-is (callers that point at a remote absolute URL pre-encode it themselves).
export function sessionSpecQuery({
  config,
  session,
  sessionName = 'Screenshot',
}: {
  config: string
  session: object
  sessionName?: string
}): string {
  return `?config=${config}&session=${encodeSessionSpec(session)}&sessionName=${encodeURIComponent(sessionName)}`
}
