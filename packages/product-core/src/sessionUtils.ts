import { diffTrackConfig, flattenTrackConfigDelta } from '@jbrowse/core/util'
import {
  getChildType,
  getPropertyMembers,
  getSnapshot,
  isArrayType,
  isMapType,
  isModelType,
  isReferenceType,
  isValidReference,
} from '@jbrowse/mobx-state-tree'

import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
  types,
} from '@jbrowse/mobx-state-tree'

type MSTArray = Instance<ReturnType<typeof types.array>>
type MSTMap = Instance<ReturnType<typeof types.map>>

// A node dropped from a freshly-loaded session, identified for a user-facing
// message. `configuration` is the (unresolved) trackId; `type` the track type.
export interface DroppedSessionNode {
  type?: string
  configuration?: string
}

// Cleans a freshly-loaded session in place by dropping any array/map element
// that can't be hydrated — e.g. an open track whose `configuration` reference
// resolves to a dangling id or a structurally-invalid config and throws when
// read. Dropping keeps the invariant that the open set only ever holds usable
// tracks (matching the open/add paths, which refuse invalid configs), so
// downstream code never has to defend against a track whose config access
// throws. Returns the dropped nodes so the caller can tell the user which
// tracks went missing.
//
// Dangling references in collections are NOT this function's job: every session
// reference is a `types.safeReference`, whose onInvalidated removes the entry
// from its parent at load. The `isValidReference` branch below is a backstop
// for any future plain `types.reference` collection.
export function filterSessionInPlace(
  node: IAnyStateTreeNode,
  type: IAnyType,
  dropped: DroppedSessionNode[] = [],
): DroppedSessionNode[] {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node !== undefined) {
    if (isArrayType(type)) {
      const array = node as MSTArray
      const childType = getChildType(node)
      const isRef = isReferenceType(childType)
      for (let i = 0; i < array.length;) {
        if (!walkChildOrDrop(() => array[i], childType, isRef, dropped)) {
          array.splice(i, 1)
        } else {
          i += 1
        }
      }
    } else if (isMapType(type)) {
      const map = node as MSTMap
      const childType = getChildType(map)
      const isRef = isReferenceType(childType)
      for (const key of map.keys()) {
        if (!walkChildOrDrop(() => map.get(key), childType, isRef, dropped)) {
          map.delete(key)
        }
      }
    } else if (isModelType(type)) {
      const { properties } = getPropertyMembers(node)
      // A node holding a `configuration` reference is a track/display/
      // connection. Its only load-time integrity concern is that the config
      // resolves: reading it throws for a dangling id or a structurally-invalid
      // config, which the caller turns into a drop. Stop here instead of
      // recursing — the first config-bearing node on the path to a display is
      // the track itself, and recursing past it would eagerly instantiate child
      // state models (displays) and run their afterAttach before the view is
      // measured. That throws on view.width and would be misread as an invalid
      // node, dropping a valid track. Display configs resolve through their own
      // safety net (the track config's preProcessSnapshot injects a stub
      // display per registered type).
      if ('configuration' in properties) {
        void node.configuration
      } else {
        for (const [pname, ptype] of Object.entries(properties)) {
          filterSessionInPlace(node[pname], ptype, dropped)
        }
      }
    }
  }
  return dropped
}

// Returns false if the collection element should be dropped: a dangling
// reference (removed silently — see header), or a config-bearing node that
// throws while hydrating (recorded in `dropped` so the caller can report it).
// Otherwise recurses into it and returns true.
function walkChildOrDrop(
  get: () => IAnyStateTreeNode,
  childType: IAnyType,
  isRef: boolean,
  dropped: DroppedSessionNode[],
) {
  if (isRef) {
    return isValidReference(get)
  }
  let child: IAnyStateTreeNode | undefined
  try {
    child = get()
    filterSessionInPlace(child, childType, dropped)
    return true
  } catch (e) {
    console.error(e)
    dropped.push(describeDroppedNode(child))
    return false
  }
}

// Identifies a dropped node for a user-facing message by reading its serialized
// snapshot, which keeps a dangling `configuration` reference (the usual cause of
// a drop) from throwing again — references serialize to their stored id string.
function describeDroppedNode(
  node: IAnyStateTreeNode | undefined,
): DroppedSessionNode {
  try {
    if (node !== undefined) {
      const snap: { type?: unknown; configuration?: unknown } =
        getSnapshot(node)
      return {
        type: typeof snap.type === 'string' ? snap.type : undefined,
        configuration:
          typeof snap.configuration === 'string'
            ? snap.configuration
            : undefined,
      }
    }
  } catch (e) {
    console.error(e)
  }
  return {}
}

// A file location that will not open on jbrowse-web: a desktop LocalPathLocation
// or a same-session-only BlobLocation/FileHandleLocation. `trackId`/`trackName`
// name the enclosing track so an export dialog can tell the user which tracks
// are affected.
export interface NonPortableLocation {
  locationType: string
  name: string
  trackId?: string
  trackName?: string
}

export interface WebPortabilityReport {
  // every non-UriLocation found, in document order
  nonPortable: NonPortableLocation[]
  // true when every file location in the snapshot is a UriLocation, i.e. the
  // session can be opened on jbrowse-web as-is
  portable: boolean
}

function locationDisplayName(loc: Record<string, unknown>): string {
  switch (loc.locationType) {
    case 'LocalPathLocation':
      return typeof loc.localPath === 'string' ? loc.localPath : 'local file'
    case 'BlobLocation':
    case 'FileHandleLocation':
      return typeof loc.name === 'string' ? loc.name : 'local file'
    case 'UriLocation':
      return typeof loc.uri === 'string' ? loc.uri : 'remote file'
    default:
      return 'unknown location'
  }
}

interface TrackContext {
  trackId: string
  trackName?: string
}

function walkLocations(
  node: unknown,
  track: TrackContext | undefined,
  out: NonPortableLocation[],
) {
  if (Array.isArray(node)) {
    for (const item of node) {
      walkLocations(item, track, out)
    }
  } else if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>
    const nextTrack =
      typeof obj.trackId === 'string'
        ? {
            trackId: obj.trackId,
            trackName: typeof obj.name === 'string' ? obj.name : undefined,
          }
        : track
    if (
      typeof obj.locationType === 'string' &&
      obj.locationType !== 'UriLocation'
    ) {
      out.push({
        locationType: obj.locationType,
        name: locationDisplayName(obj),
        trackId: nextTrack?.trackId,
        trackName: nextTrack?.trackName,
      })
    }
    for (const key of Object.keys(obj)) {
      walkLocations(obj[key], nextTrack, out)
    }
  }
}

// Walks a session/config snapshot and reports every file location that won't
// open on jbrowse-web. Anything that isn't a UriLocation (local paths from
// desktop, or blob/file-handle locations bound to another browser session) is
// non-portable; a fully-UriLocation snapshot is portable and can be handed to
// the web app directly.
export function analyzeWebPortability(snapshot: unknown): WebPortabilityReport {
  const nonPortable: NonPortableLocation[] = []
  walkLocations(snapshot, undefined, nonPortable)
  return { nonPortable, portable: nonPortable.length === 0 }
}

// A track config snapshot, loosely typed. planWebExport reads `trackId` and, in
// the hosted-base strategy, diffs the whole object against its base track.
export interface TrackSnapshot {
  trackId: string
  [key: string]: unknown
}

// A jbrowse-desktop save snapshot (`{...jbrowse, defaultSession}`), narrowed to
// the fields planWebExport reads.
export interface WebExportInput {
  assemblies?: { name: string }[]
  tracks?: TrackSnapshot[]
  configuration?: { sourceConfigUrl?: string }
  defaultSession?: Record<string, unknown>
}

// The hosted config a session was bootstrapped from, fetched fresh so the delta
// reflects the live hub (assemblies/tracks it already provides). The caller must
// run `addRelativeUris` on it first so its track locations carry the same
// `baseUri` the desktop session stored at load — otherwise a track diff flags
// every relative-URI location as an edit.
export interface HostedBaseConfig {
  assemblies?: { name: string }[]
  tracks?: TrackSnapshot[]
  [key: string]: unknown
}

export interface WebExportPlan {
  // hostedConfigBase: open `?config=<configUrl>` and let the hosted config
  // provide the assembly + its tracks; the session carries only the delta.
  // selfContained: no usable hosted base, so the session carries its own
  // assemblies + tracks and web loads it with `?config=none`.
  strategy: 'hostedConfigBase' | 'selfContained'
  configUrl?: string
  // the session snapshot to encode into `?session=encoded-<...>`
  session: Record<string, unknown>
  // full portability detection over the input snapshot
  report: WebPortabilityReport
  // distinct display names of tracks excluded from `session` because they
  // reference local files jbrowse-web can't open (empty when fully portable)
  droppedTracks: string[]
  // distinct names of local files that block the whole session from loading on
  // the web and can't be shed by dropping a track — an assembly's own sequence/
  // alias files, or any non-track local file. Empty when fully portable.
  blockingFiles: string[]
}

// Collects every `trackId` string anywhere within a snapshot subtree. An
// assembly's sequence config carries a trackId (`<name>-ReferenceSequenceTrack`,
// injected by the assembly config's preProcessSnapshot), so this is how
// planWebExport tells an assembly's own structural trackIds from real user
// tracks — a local sequence file surfaces in the report tagged with the sequence
// trackId, but it is not a droppable track.
function collectTrackIds(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectTrackIds(item, out)
    }
  } else if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>
    if (typeof obj.trackId === 'string') {
      out.add(obj.trackId)
    }
    for (const key of Object.keys(obj)) {
      collectTrackIds(obj[key], out)
    }
  }
  return out
}

// Distinct file display names of a set of non-portable locations, in first-seen
// order.
function distinctNames(locations: NonPortableLocation[]): string[] {
  return [...new Set(locations.map(l => l.name))]
}

// Reads a `trackId` off a loosely-typed session-track snapshot, or undefined.
function readTrackId(track: unknown): string | undefined {
  const id = isRecord(track) ? track.trackId : undefined
  return typeof id === 'string' ? id : undefined
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

// Concatenate session-track lists, keeping the last entry per trackId so a track
// carried by both the prior session and the current snapshot ships once (a
// duplicate trackId is an MST identifier collision on load). Entries without a
// readable trackId are kept as-is, in order.
function concatTracksByTrackId(...lists: unknown[][]): unknown[] {
  const byId = new Map<string, unknown>()
  const out: unknown[] = []
  for (const t of lists.flat()) {
    const id = readTrackId(t)
    if (id === undefined) {
      out.push(t)
    } else {
      byId.set(id, t)
    }
  }
  return [...out, ...byId.values()]
}

// The user tracks (not an assembly's own structural sequence/alias files) that
// reference a local file: their trackIds, to drop from the export, and display
// names, to report to the user. Assembly-owned files can't be dropped by
// removing a track, so they're excluded here and surface as blockingFiles.
function nonPortableUserTracks(
  report: WebPortabilityReport,
  assemblyTrackIds: Set<string>,
) {
  const locs = report.nonPortable.flatMap(l =>
    l.trackId && !assemblyTrackIds.has(l.trackId)
      ? [{ trackId: l.trackId, name: l.trackName ?? l.trackId }]
      : [],
  )
  return {
    ids: new Set(locs.map(l => l.trackId)),
    names: [...new Set(locs.map(l => l.name))],
  }
}

// Splits the portable tracks against the hosted base. A track with no base entry
// is user-added and ships whole in `addedTracks` (→ sessionTracks). A track that
// matches a base entry but was edited on desktop (desktop edits jbrowse.tracks in
// place, keeping the base trackId) becomes an `editDeltas` entry — the same
// channel the web session uses — so the recipient's base is overlaid with the
// sender's edits. An unedited base track produces neither and resolves from the
// base.
function splitTracksAgainstBase(
  tracks: TrackSnapshot[],
  baseTracks: TrackSnapshot[],
) {
  const baseById = new Map(baseTracks.map(t => [t.trackId, t]))
  const addedTracks = tracks.filter(t => !baseById.has(t.trackId))
  const editDeltas = Object.fromEntries(
    tracks.flatMap((track): [string, Record<string, unknown>][] => {
      const base = baseById.get(track.trackId)
      if (!base) {
        return []
      }
      const delta = diffTrackConfig(base, track)
      // gate on real slot changes, not the identity keys / injected display
      // stubs a raw diff carries (matches the web session's "is edited" test)
      return flattenTrackConfigDelta(base, delta).length > 0
        ? [[track.trackId, delta]]
        : []
    }),
  )
  return { addedTracks, editDeltas }
}

// Overlays edited-track deltas onto the session's trackConfigDeltas, preserving
// any the base session already carried. A no-op (returns the session unchanged)
// when there are no edits, so the exported snapshot stays minimal.
function withDeltas(
  session: Record<string, unknown>,
  editDeltas: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(editDeltas).length === 0) {
    return session
  }
  const prior = isRecord(session.trackConfigDeltas)
    ? session.trackConfigDeltas
    : {}
  return { ...session, trackConfigDeltas: { ...prior, ...editDeltas } }
}

// Decides how to hand a desktop session to jbrowse-web. When the session was
// launched from a hosted hub config (sourceConfigUrl) that still covers all of
// its assemblies, that config is reused as the base and only user-added/edited
// tracks ride along; otherwise the session is made self-contained. `baseConfig`
// is the fetched hub config (already rebased with addRelativeUris by the caller),
// used to tell hub tracks from user-added ones and to diff edited hub tracks.
export function planWebExport(
  snapshot: WebExportInput,
  baseConfig?: HostedBaseConfig,
): WebExportPlan {
  const report = analyzeWebPortability(snapshot)
  const sourceConfigUrl = snapshot.configuration?.sourceConfigUrl
  const assemblies = snapshot.assemblies ?? []
  const defaultSession = snapshot.defaultSession ?? {}
  const priorSessionAssemblies = asArray(defaultSession.sessionAssemblies)

  // An assembly's sequence config owns a trackId (`<name>-ReferenceSequenceTrack`),
  // so a local sequence/alias file shows up in the report tagged with that
  // trackId even though it's structural, not a droppable track. Collect the
  // trackIds owned by shipped assemblies so those files count as blocking (they
  // break the whole session) rather than as dropped tracks.
  const assemblyTrackIds = collectTrackIds([
    ...assemblies,
    ...priorSessionAssemblies,
  ])

  const dropped = nonPortableUserTracks(report, assemblyTrackIds)
  const keep = (t: unknown) => {
    const id = readTrackId(t)
    return !id || !dropped.ids.has(id)
  }
  const tracks = (snapshot.tracks ?? []).filter(keep)
  const priorSessionTracks = asArray(defaultSession.sessionTracks).filter(keep)

  const baseAssemblyNames = new Set(
    (baseConfig?.assemblies ?? []).map(a => a.name),
  )
  const coveredByBase =
    !!sourceConfigUrl &&
    !!baseConfig &&
    assemblies.every(a => baseAssemblyNames.has(a.name))

  if (coveredByBase) {
    const { addedTracks, editDeltas } = splitTracksAgainstBase(
      tracks,
      baseConfig.tracks ?? [],
    )
    return {
      strategy: 'hostedConfigBase',
      configUrl: sourceConfigUrl,
      session: withDeltas(
        {
          ...defaultSession,
          sessionTracks: concatTracksByTrackId(priorSessionTracks, addedTracks),
        },
        editDeltas,
      ),
      report,
      droppedTracks: dropped.names,
      // assemblies come from the hosted config, so their local files aren't
      // shipped and can't block; only stray non-track local files remain
      blockingFiles: distinctNames(report.nonPortable.filter(l => !l.trackId)),
    }
  }
  return {
    strategy: 'selfContained',
    session: {
      ...defaultSession,
      sessionAssemblies: [...priorSessionAssemblies, ...assemblies],
      sessionTracks: concatTracksByTrackId(priorSessionTracks, tracks),
    },
    report,
    droppedTracks: dropped.names,
    // self-contained ships the assemblies, so their local files (and any other
    // non-track local file) block the session from loading on the web
    blockingFiles: distinctNames(
      report.nonPortable.filter(l => !l.trackId || assemblyTrackIds.has(l.trackId)),
    ),
  }
}

// The deployed jbrowse-web the desktop "export to web" action targets. Stable
// per the maintainers; a future target will be added alongside, not replace it.
export const DEFAULT_WEB_BASE_URL = 'https://jbrowse.org/code/jb2/latest/'

// Assembles the jbrowse-web URL for an export plan. `sessionParam` is the
// ready-made `session` value: `share-<id>` for a short lambda link (pass its
// `password`) or `encoded-<b64>`/`json-<json>` for an inline long link.
// `config` points at the hosted base, or `none` for a self-contained session.
//
// The large inline modes (`encoded-`/`json-`) go in the hash fragment, which is
// never sent to the server and so can't trip the request-line limit (HTTP 414)
// the query string can — a self-contained export carries its own assemblies and
// tracks and is exactly the biggest kind of session. The tiny `share-<id>` short
// link stays in the query string. Mirrors jbrowse-web's buildShareUrl; the
// SessionLoader reads `session=`/`config=` from either location (hash XOR query).
export function buildWebExportUrl(
  plan: WebExportPlan,
  sessionParam: string,
  options: { password?: string; webBaseUrl?: string } = {},
): string {
  const url = new URL(options.webBaseUrl ?? DEFAULT_WEB_BASE_URL)
  const params = new URLSearchParams()
  params.set('config', plan.configUrl ?? 'none')
  params.set('session', sessionParam)
  if (options.password) {
    params.set('password', options.password)
  }
  const str = params.toString()
  if (sessionParam.startsWith('share-')) {
    url.search = str
  } else {
    url.hash = str
  }
  return url.href
}
