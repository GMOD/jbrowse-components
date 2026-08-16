import { maybePluginUrl } from '@jbrowse/core/pluginDefinitions'
import {
  SHARE_PREFIX,
  diffTrackConfig,
  flattenTrackConfigDelta,
} from '@jbrowse/core/util'
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

import { asArray, isRecord } from './snapshotUtils.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
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
  plugins?: PluginDefinition[]
  connections?: unknown[]
  configuration?: { sourceConfigUrl?: string; webExportUrl?: string }
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
  // jbrowse-web loads both of these itself when it opens `?config=<configUrl>`,
  // so an export reusing this config as its base only has to carry the ones it
  // does not already declare
  plugins?: PluginDefinition[]
  connections?: unknown[]
  // jbrowse-web resolves the session-share store from the config it loaded, so
  // an export reusing this config as its base has to upload short links there
  configuration?: { shareURL?: string }
  [key: string]: unknown
}

export interface WebExportPlan {
  // hostedConfigBase: open `?config=<configUrl>` and let the hosted config
  // provide the assembly + its tracks; the session carries only the delta.
  // selfContained: no usable hosted base, so the session carries its own
  // assemblies + tracks and web loads it with `?config=none`.
  strategy: 'hostedConfigBase' | 'selfContained'
  configUrl?: string
  // the jbrowse-web deployment the link points at
  webBaseUrl: string
  // the session snapshot to encode into `?session=encoded-<...>`
  session: Record<string, unknown>
  // distinct display names of tracks excluded from `session` because they
  // reference local files jbrowse-web can't open (empty when fully portable)
  droppedTracks: string[]
  // distinct names of local files that survive into `session` and so can't be
  // shed by dropping a track — an assembly's own sequence/alias files, an open
  // connection track's config, any non-track local file. Empty when the
  // exported session is fully portable.
  blockingFiles: string[]
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

function readAssemblyName(assembly: unknown): string | undefined {
  const name = isRecord(assembly) ? assembly.name : undefined
  return typeof name === 'string' ? name : undefined
}

// Same idea as concatTracksByTrackId for assemblies, whose identifier is their
// `name`. A duplicate is worse here than for tracks: it doesn't fail at load,
// it makes every assembly's `configuration` safeReference ambiguous, so the
// assemblyManager throws on the next read of one and the session is dead.
function concatAssembliesByName(...lists: unknown[][]): unknown[] {
  const byName = new Map<string, unknown>()
  const out: unknown[] = []
  for (const a of lists.flat()) {
    const name = readAssemblyName(a)
    if (name === undefined) {
      out.push(a)
    } else {
      byName.set(name, a)
    }
  }
  return [...out, ...byName.values()]
}

// Session assemblies that don't collide with one the recipient's config already
// provides. `sessionAssemblies` and `jbrowse.assemblies` are concatenated into
// one namespace on the far side (`AssembliesMixin.assemblies`), and the
// duplicate-name guard there lives in `addSessionAssembly` — an *add* path,
// which a deserialized snapshot never goes through. So a name the hosted base
// also uses is not rejected on load, it silently makes every assembly's
// `configuration` safeReference ambiguous and takes the session down on the
// next read. The base's copy wins because it is the one `?config=` guarantees
// is there.
//
// Only the hostedConfigBase strategy needs this. A self-contained export ships
// no config at all, and concatAssembliesByName already keeps its own two lists
// from colliding with each other.
function withoutBaseAssemblies(
  sessionAssemblies: unknown[],
  baseAssemblyNames: Set<string>,
): unknown[] {
  return sessionAssemblies.filter(a => {
    const name = readAssemblyName(a)
    return !name || !baseAssemblyNames.has(name)
  })
}

// The `sessionAssemblies` override for a hosted-base session, or nothing at all
// when the session had none — the spread of `defaultSession` is what carries
// them otherwise, so an unconditional key would add an empty array to every
// export that never had one.
function hostedSessionAssemblies(
  prior: unknown[],
  baseAssemblyNames: Set<string>,
) {
  return prior.length > 0
    ? { sessionAssemblies: withoutBaseAssemblies(prior, baseAssemblyNames) }
    : {}
}

// The trackIds the export is free to drop: the ones that name an entry in a
// track list it actually assembles. Everything else a location can be tagged
// with is structural and stays — an assembly's own sequence config carries
// `<name>-ReferenceSequenceTrack`, and an open connection track's config lives
// in `connectionTrackConfigs`, which rides along inside the session snapshot.
function droppableTrackIds(
  tracks: TrackSnapshot[],
  sessionTracks: unknown[],
): Set<string> {
  return new Set(
    [...tracks, ...sessionTracks].flatMap(t => readTrackId(t) ?? []),
  )
}

// The tracks that reference a local file and can be shed by dropping them:
// their trackIds, to filter the shipped track lists with, and display names, to
// report to the user. A local file that no droppable track owns can't be shed
// this way and surfaces as a blockingFile instead.
function nonPortableUserTracks(
  report: WebPortabilityReport,
  droppable: Set<string>,
) {
  const locs = report.nonPortable.flatMap(l =>
    l.trackId && droppable.has(l.trackId)
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

// The plugin definitions the recipient will not already have, carried in the
// session as `sessionPlugins` — the one channel a jbrowse-web session has for
// them, and one it triages before loading (SessionLoader.loadSession). Without
// this, a desktop session using a plugin's view or track type opens on a
// jbrowse-web that never registered the type, and the view is dropped on load.
//
// Under `hostedConfigBase` jbrowse-web loads the base config's own `plugins[]`,
// so only the extras ride along; a `selfContained` export opens `?config=none`
// and has no config to load any from, so it carries them all. Identity is the
// url a definition loads from (`maybePluginUrl`) rather than its name, since an
// ESM/CJS definition need not have one; a definition naming no loader at all is
// never "the same plugin" as another, so it is always carried.
function extraPlugins(
  plugins: PluginDefinition[],
  basePlugins: PluginDefinition[],
) {
  const baseUrls = new Set(basePlugins.flatMap(p => maybePluginUrl(p) ?? []))
  return plugins.filter(p => {
    const url = maybePluginUrl(p)
    return !url || !baseUrls.has(url)
  })
}

// Connections the recipient will not already have, carried the same way and for
// the same reason as the plugins above: desktop keeps them in `jbrowse
// .connections`, which nothing in the export ships, so without this a session
// with a track hub arrives on the web with the hub gone. Only the connection
// tracks the sender had open survive on their own, through the session's
// `connectionTrackConfigs`; the hub itself — and every track in it the recipient
// might want to open next — needs `sessionConnections`, jbrowse-web's
// session-level counterpart of `jbrowse.connections`.
//
// Identity is `connectionId`, which is what the recipient's own
// `connections` getter concatenates on, so shipping one the base already
// declares would list the same hub twice.
function extraConnections(connections: unknown[], baseConnections: unknown[]) {
  const baseIds = new Set(baseConnections.flatMap(c => readId(c) ?? []))
  return connections.filter(c => {
    const id = readId(c)
    return !id || !baseIds.has(id)
  })
}

function readId(connection: unknown): string | undefined {
  const id = isRecord(connection) ? connection.connectionId : undefined
  return typeof id === 'string' ? id : undefined
}

// Adds the session-level carriers to the exported session, leaving each key out
// entirely when it would be empty so the exported snapshot stays minimal (same
// rule as withDeltas above).
function withCarriedConfigs(
  session: Record<string, unknown>,
  plugins: PluginDefinition[],
  connections: unknown[],
): Record<string, unknown> {
  return {
    ...session,
    ...(plugins.length > 0 ? { sessionPlugins: plugins } : {}),
    ...(connections.length > 0 ? { sessionConnections: connections } : {}),
  }
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
  const allTracks = snapshot.tracks ?? []
  const allSessionTracks = asArray(defaultSession.sessionTracks)

  const dropped = nonPortableUserTracks(
    report,
    droppableTrackIds(allTracks, allSessionTracks),
  )
  const keep = (t: unknown) => {
    const id = readTrackId(t)
    return !id || !dropped.ids.has(id)
  }
  const tracks = allTracks.filter(keep)
  const priorSessionTracks = allSessionTracks.filter(keep)

  const baseAssemblyNames = new Set(
    (baseConfig?.assemblies ?? []).map(a => a.name),
  )
  const coveredByBase =
    !!sourceConfigUrl &&
    !!baseConfig &&
    assemblies.every(a => baseAssemblyNames.has(a.name))

  const plugins = snapshot.plugins ?? []
  const connections = snapshot.connections ?? []
  // defined exactly when the hostedConfigBase strategy applies, so it doubles as
  // the strategy flag for the shared tail below
  const hosted = coveredByBase
    ? splitTracksAgainstBase(tracks, baseConfig.tracks ?? [])
    : undefined

  const session = withCarriedConfigs(
    hosted
      ? withDeltas(
          {
            ...defaultSession,
            ...hostedSessionAssemblies(
              priorSessionAssemblies,
              baseAssemblyNames,
            ),
            sessionTracks: concatTracksByTrackId(
              priorSessionTracks,
              hosted.addedTracks,
            ),
          },
          hosted.editDeltas,
        )
      : {
          ...defaultSession,
          sessionAssemblies: concatAssembliesByName(
            priorSessionAssemblies,
            assemblies,
          ),
          sessionTracks: concatTracksByTrackId(priorSessionTracks, tracks),
        },
    hosted ? extraPlugins(plugins, baseConfig?.plugins ?? []) : plugins,
    hosted
      ? extraConnections(connections, asArray(baseConfig?.connections))
      : connections,
  )
  return {
    strategy: hosted ? 'hostedConfigBase' : 'selfContained',
    configUrl: hosted ? sourceConfigUrl : undefined,
    webBaseUrl: resolveWebBaseUrl(snapshot.configuration?.webExportUrl),
    session,
    droppedTracks: dropped.names,
    // Re-run detection over the session that will actually ship rather than
    // filtering the input report by trackId. The two are not the same set, in
    // both directions: a hosted-base export leaves the config's assemblies
    // behind (their local files are the base's problem, not the recipient's)
    // but still ships the prior session's `sessionAssemblies`, and either
    // strategy ships `connectionTrackConfigs` that the droppable-track filter
    // above never touches. Anything non-portable still present here survived
    // the drop and so blocks the session by definition.
    blockingFiles: distinctNames(analyzeWebPortability(session).nonPortable),
  }
}

// The deployed jbrowse-web the desktop "export to web" action targets. Stable
// per the maintainers; a future target will be added alongside, not replace it.
export const DEFAULT_WEB_BASE_URL = 'https://jbrowse.org/code/jb2/latest/'

// Where an export opens. A config can point its users at a different jbrowse-web
// through the desktop-only `webExportUrl` slot — a site that runs its own
// deployment, and whose data may only be reachable from it.
//
// A value that isn't an absolute http(s) url falls back rather than throwing:
// this runs inside the export, and a typo in a config slot must not be able to
// make exporting impossible. Same posture as the base-config fetch, which logs
// and falls back to a self-contained export.
function resolveWebBaseUrl(webExportUrl: string | undefined) {
  if (!webExportUrl) {
    return DEFAULT_WEB_BASE_URL
  }
  try {
    const url = new URL(webExportUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`not an http(s) url: ${webExportUrl}`)
    }
    return url.href
  } catch (e) {
    console.error(e)
    return DEFAULT_WEB_BASE_URL
  }
}

// Assembles the jbrowse-web URL for an export plan. `sessionParam` is the
// ready-made `session` value: `share-<id>` for a short lambda link (pass its
// `password`) or `encoded-<b64>`/`json-<json>` for an inline long link.
// `config` points at the hosted base, or `none` for a self-contained session.
//
// `exportedFrom` stamps what produced the link. These links are artifacts —
// papers, supplements, emails — and every other thing they name moves under
// them: DEFAULT_WEB_BASE_URL is `.../latest/`, so the deployment that opens the
// session is an unknown future build, and the hosted base config the plan
// diffed against is fetched fresh on both ends and can be in a third state by
// then. Pinning either is a deployment decision; recording the producer is not,
// and it is the difference between a recipient who can say which JBrowse made
// this and one guessing. jbrowse-web reads a fixed list of params
// (createSessionLoader) and ignores the rest, so the stamp is inert there and
// stays in the address bar where a reader can see it.
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
  options: { password?: string; exportedFrom?: string } = {},
): string {
  const url = new URL(plan.webBaseUrl)
  const params = new URLSearchParams()
  params.set('config', plan.configUrl ?? 'none')
  params.set('session', sessionParam)
  if (options.password) {
    params.set('password', options.password)
  }
  if (options.exportedFrom) {
    params.set('exportedFrom', options.exportedFrom)
  }
  const str = params.toString()
  if (sessionParam.startsWith(SHARE_PREFIX)) {
    url.search = str
  } else {
    url.hash = str
  }
  return url.href
}
