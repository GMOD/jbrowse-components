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
//
// A graph track's `pane` is flattened the same way: its keys are the graph's
// settings, each one a control of its own. So is each band object of the
// alignments and MAF displays (`coverage`, `sashimi`, ...), to one entry per
// member under its dotted path, `coverage.show`, `sashimi.filter.minReads`.
export function specTrackSettings(entry: SpecTrackEntry): [string, unknown][] {
  if (typeof entry === 'string') {
    return []
  }
  const { trackId, displaySnapshot, ...inline } = entry
  const { pane, ...display } = {
    ...inline,
    ...(isPlainObject(displaySnapshot) ? displaySnapshot : {}),
  }
  return Object.entries({
    ...display,
    ...(isPlainObject(pane) ? pane : {}),
  }).flatMap(([key, value]) => settingEntries(key, value))
}

/** A display settings object as the per-field walk reads it. */
export function flatSettings(settings: Record<string, unknown>) {
  return Object.entries(settings).flatMap(([key, value]) =>
    settingEntries(key, value),
  )
}

function settingEntries(key: string, value: unknown): [string, unknown][] {
  return BAND_OBJECTS.has(key) && isPlainObject(value)
    ? bandEntries(key, value)
    : [[key, value]]
}

/** The inverse of `flatSettings`, for a predicate the plugin owns. */
export function nestedSettings(entries: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  const band = (name: string) => {
    const held = out[name]
    return isPlainObject(held) ? held : (out[name] = {}) as Record<string, unknown>
  }
  for (const [key, value] of Object.entries(entries)) {
    const [head = key, ...path] = key.split('.')
    if (key === 'readConnections' && typeof value === 'string') {
      Object.assign(
        band(key),
        value === 'off' ? { show: false } : { show: true, mark: value },
      )
    } else if (path.length === 0) {
      out[key] = value
    } else {
      let node = band(head)
      for (const segment of path.slice(0, -1)) {
        node = isPlainObject(node[segment])
          ? (node[segment])
          : (node[segment] = {})
      }
      node[path.at(-1)!] = value
    }
  }
  return out
}

const BAND_OBJECTS = new Set([
  'coverage',
  'pileup',
  'sashimi',
  'readConnections',
  'conservation',
])

// A band's `show` and `mark` are one radio on the read connections ("None",
// "Read arcs", "Read cloud"), so they come out as the one `readConnections`
// entry that radio writes; a band's `filter` is flattened one level further,
// one entry per category or floor.
function bandEntries(
  band: string,
  members: Record<string, unknown>,
): [string, unknown][] {
  const { show, mark, filter, ...rest } = members
  const drawn: [string, unknown][] =
    band === 'readConnections' && show !== undefined
      ? [[band, show === true ? (mark ?? 'arc') : 'off']]
      : [
          ...(show !== undefined
            ? [[`${band}.show`, show] as [string, unknown]]
            : []),
          ...(mark !== undefined
            ? [[`${band}.mark`, mark] as [string, unknown]]
            : []),
        ]
  return [
    ...drawn,
    ...Object.entries(rest).map(
      ([member, value]) => [`${band}.${member}`, value] as [string, unknown],
    ),
    ...(isPlainObject(filter)
      ? Object.entries(filter).map(
          ([member, value]) =>
            [`${band}.filter.${member}`, value] as [string, unknown],
        )
      : []),
  ]
}

// The display a track entry names, when it names one — inline as `type` or
// inside `displaySnapshot`, the nested one winning for the same reason
// specTrackSettings flattens that way.
//
// Undefined when the entry leaves the choice to the app, which is not a case a
// recipe can quietly assume its way out of: `pickDisplayForView` resolves it
// from the track config's own declared displays intersected with the view's
// supported types, and neither is visible to a static script. Recipes whose
// menu differs per display therefore emit nothing rather than guessing the
// common case — a wrong menu name is worse than an acknowledged gap.
export function specDisplayType(entry: SpecTrackEntry): string | undefined {
  if (typeof entry === 'string') {
    return undefined
  }
  const nested = isPlainObject(entry.displaySnapshot)
    ? entry.displaySnapshot.type
    : undefined
  if (typeof nested === 'string') {
    return nested
  }
  return typeof entry.type === 'string' ? entry.type : undefined
}

// A synteny view nests its tracks one level deeper — `tracks: [[trackId]]`, one
// row per pair of adjacent views — so flatten before treating entries as tracks
// (indexing an array as an object otherwise yields "0" as a field name).
export function specTracks(view: SpecView): SpecTrackEntry[] {
  return (view.tracks ?? []).flatMap(entry =>
    Array.isArray(entry) ? entry : [entry],
  )
}

// Every track a view opens, its rows' included.
export function openedTrackIds(view: SpecView): string[] {
  return [
    ...specTracks(view).map(specTrackId),
    ...(view.views ?? []).flatMap(openedTrackIds),
  ]
}
