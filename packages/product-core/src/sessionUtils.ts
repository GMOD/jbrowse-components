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

// A jbrowse-desktop save snapshot (`{...jbrowse, defaultSession}`), narrowed to
// the fields planWebExport reads.
export interface WebExportInput {
  assemblies?: { name: string }[]
  tracks?: { trackId: string }[]
  configuration?: { sourceConfigUrl?: string }
  defaultSession?: Record<string, unknown>
}

// The hosted config a session was bootstrapped from, fetched fresh so the delta
// reflects the live hub (assemblies/tracks it already provides).
export interface HostedBaseConfig {
  assemblies?: { name: string }[]
  tracks?: { trackId: string }[]
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
}

// Reads a `trackId` off a loosely-typed session-track snapshot, or undefined.
function readTrackId(track: unknown): string | undefined {
  const id =
    typeof track === 'object' && track !== null
      ? (track as Record<string, unknown>).trackId
      : undefined
  return typeof id === 'string' ? id : undefined
}

// Decides how to hand a desktop session to jbrowse-web. When the session was
// launched from a hosted hub config (sourceConfigUrl) that still covers all of
// its assemblies, that config is reused as the base and only user-added tracks
// ride along; otherwise the session is made self-contained. `baseConfig` is the
// fetched hub config, used to tell hub tracks from user-added ones.
export function planWebExport(
  snapshot: WebExportInput,
  baseConfig?: HostedBaseConfig,
): WebExportPlan {
  const report = analyzeWebPortability(snapshot)
  // trackIds whose tracks reference a local file: these can never load on the
  // web, so they're dropped from the exported session rather than shipped
  // broken. Locations without a trackId (e.g. a local assembly sequence) can't
  // be dropped as a track — the dialog surfaces those separately.
  const nonPortableTrackIds = new Set(
    report.nonPortable.flatMap(l => (l.trackId ? [l.trackId] : [])),
  )
  const droppedTracks = [
    ...new Set(
      report.nonPortable.flatMap(l =>
        l.trackId ? [l.trackName ?? l.trackId] : [],
      ),
    ),
  ]
  const sourceConfigUrl = snapshot.configuration?.sourceConfigUrl
  const tracks = (snapshot.tracks ?? []).filter(
    t => !nonPortableTrackIds.has(t.trackId),
  )
  const assemblies = snapshot.assemblies ?? []
  const defaultSession = snapshot.defaultSession ?? {}
  const priorSessionTracks = (
    Array.isArray(defaultSession.sessionTracks)
      ? (defaultSession.sessionTracks as unknown[])
      : []
  ).filter(t => {
    const id = readTrackId(t)
    return !id || !nonPortableTrackIds.has(id)
  })
  const priorSessionAssemblies = Array.isArray(defaultSession.sessionAssemblies)
    ? (defaultSession.sessionAssemblies as unknown[])
    : []

  const baseAssemblyNames = new Set(
    (baseConfig?.assemblies ?? []).map(a => a.name),
  )
  const coveredByBase =
    !!sourceConfigUrl &&
    !!baseConfig &&
    assemblies.every(a => baseAssemblyNames.has(a.name))

  if (coveredByBase) {
    const baseTrackIds = new Set((baseConfig.tracks ?? []).map(t => t.trackId))
    const addedTracks = tracks.filter(t => !baseTrackIds.has(t.trackId))
    return {
      strategy: 'hostedConfigBase',
      configUrl: sourceConfigUrl,
      session: {
        ...defaultSession,
        sessionTracks: [...priorSessionTracks, ...addedTracks],
      },
      report,
      droppedTracks,
    }
  }
  return {
    strategy: 'selfContained',
    session: {
      ...defaultSession,
      sessionAssemblies: [...priorSessionAssemblies, ...assemblies],
      sessionTracks: [...priorSessionTracks, ...tracks],
    },
    report,
    droppedTracks,
  }
}

// The deployed jbrowse-web the desktop "export to web" action targets. Stable
// per the maintainers; a future target will be added alongside, not replace it.
export const DEFAULT_WEB_BASE_URL = 'https://jbrowse.org/code/jb2/latest/'

// Assembles the jbrowse-web URL for an export plan. `sessionParam` is the
// ready-made `session` value: `share-<id>` for a short lambda link (pass its
// `password`) or `encoded-<b64>` for a self-contained long link. `config`
// points at the hosted base, or `none` for a self-contained session.
export function buildWebExportUrl(
  plan: WebExportPlan,
  sessionParam: string,
  options: { password?: string; webBaseUrl?: string } = {},
): string {
  const url = new URL(options.webBaseUrl ?? DEFAULT_WEB_BASE_URL)
  url.searchParams.set('config', plan.configUrl ?? 'none')
  url.searchParams.set('session', sessionParam)
  if (options.password) {
    url.searchParams.set('password', options.password)
  }
  return url.href
}

// Walks a JSON config object and stamps a `baseUri` next to every object
// containing a `uri` key, so relative URIs can later be resolved against the
// config's own location.
export function addRelativeUris(
  config: Record<string, unknown> | null,
  base: URL,
) {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object' && config[key] !== null) {
        addRelativeUris(config[key] as Record<string, unknown>, base)
      } else if (key === 'uri') {
        config.baseUri = config.baseUri ?? base.href
      }
    }
  }
}
