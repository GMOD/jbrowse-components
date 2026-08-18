import { storeBlobLocation } from '@jbrowse/core/util'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BlobLocation } from '@jbrowse/core/util'

/**
 * Bytes for one browser-local file, keyed by the name a track config refers to
 * it by. `Blob`/`File` pass through; anything else (a `Uint8Array` from a
 * notebook kernel's binary channel, an `ArrayBuffer` from a fetch) is wrapped.
 */
// BufferSource, not ArrayBufferView, because that is exactly what the Blob
// constructor takes: a SharedArrayBuffer-backed view is not a valid BlobPart
export type LocalFileInput = Record<string, Blob | BufferSource>

/**
 * Register in-memory bytes as browser-local files JBrowse can read, returning
 * the `name -> BlobLocation` map {@link resolveLocalFileUris} substitutes with.
 *
 * This is the escape from "the data has to be on a web server first". A
 * `BlobLocation` opens as a `BlobFile`, which serves byte ranges out of
 * `Blob.slice()` — so a bgzipped+tabixed file, a BAM with its `.bai`, or a
 * bigWig is *seeked into* exactly as if it were remote, and only the bytes the
 * current view needs are ever touched. That is the whole point of doing this
 * rather than inlining features into a config: a 200k-feature table is ~20MB of
 * JSON to serialize, ship, and hold in memory, while the same data as a tabix
 * file is a few MB the view reads a few KB of at a time.
 *
 * For hosts that hold their data in a process rather than at a URL — a notebook
 * kernel, an R session, a desktop app — this is the way in, and it needs no web
 * server, no CORS, and no temporary public bucket.
 */
export function registerLocalFiles(files: LocalFileInput) {
  return Object.fromEntries(
    Object.entries(files).map(([name, data]) => [name, register(name, data)]),
  )
}

/**
 * Fold newly-offered files into a controller's registered map, registering only
 * the names it has not seen. Registering is what mints the blobIds, so a host
 * re-stating its whole file set on every update — which is what a declarative
 * host does — pays for each file once rather than once per update.
 *
 * Only ever adds: a name already registered keeps its existing blob, because a
 * live track config points at that blobId and swapping it underneath would
 * leave the track reading bytes nothing else references.
 */
export function mergeLocalFiles(
  current: Record<string, BlobLocation>,
  files: LocalFileInput,
) {
  const fresh = Object.fromEntries(
    Object.entries(files).filter(([name]) => !current[name]),
  )
  return { ...current, ...registerLocalFiles(fresh) }
}

// Registering the same bytes twice used to mint a second blobId and leave the
// first in core's process-global blobMap forever. Nothing collects that map, so
// a host that hands the same `localFiles` to a new controller each time it
// rebuilds — which is how a host swaps genome or track set, now that the
// controller has no setters that rebuild internally — grew it without bound.
//
// Keyed on the caller's own object, which is the only identity available: bytes
// are not comparable cheaply, and two Uint8Arrays over the same buffer are
// legitimately different files. A WeakMap so a host dropping its reference to
// the data lets the entry go, and per name inside it because the same bytes can
// legitimately be registered under two names and a BlobLocation carries one.
const registered = new WeakMap<object, Map<string, BlobLocation>>()

function register(name: string, data: LocalFileInput[string]): BlobLocation {
  const byName = registered.get(data) ?? new Map<string, BlobLocation>()
  const seen = byName.get(name)
  if (seen) {
    return seen
  }
  const location = storeBlobLocation({
    blob: data instanceof File ? data : new File([data], name),
  }) as BlobLocation
  byName.set(name, location)
  registered.set(data, byName)
  return location
}

// A location node is `{ uri }` and at most the two keys that travel with it.
// Anything else carrying a `uri` is a shorthand adapter (`{ type, uri }`), and
// telling the two apart is what stops resolveLocalFileUris replacing a whole
// adapter with a bare location — see its comment.
const LOCATION_KEYS = new Set(['uri', 'baseUri', 'locationType'])

function isLocationNode(record: Record<string, unknown>) {
  return Object.keys(record).every(key => LOCATION_KEYS.has(key))
}

/**
 * Expand every shorthand adapter snapshot (`{ type, uri }`) in a config to the
 * canonical location keys its config schema declares, using that adapter type's
 * own `normalizeSnapshot` — the hook that exists so "downstream code can read
 * location keys without knowing each shorthand".
 *
 * {@link resolveLocalFileUris} has to run on the expanded form, and this is the
 * difference between `localFiles` working and silently doing nothing: the
 * shorthand puts `uri` on the *adapter*, so substituting there would replace
 * `{ type: 'BamAdapter', uri: 'x.bam' }` with a bare BlobLocation and take the
 * adapter's type with it. Expanding first moves the name onto `bamLocation`,
 * where it is a location node and substitution is what it looks like. The
 * expansion also derives the conventional index sibling (`.bai`/`.tbi`/`.crai`)
 * from the same string, so registering `x.bam` and `x.bam.bai` is enough and no
 * caller has to know which adapter wanted which file.
 *
 * Idempotent, and a no-op for an already-canonical config or an adapter type
 * that declares no shorthand.
 */
export function normalizeAdapterSnapshots<T>(
  config: T,
  pluginManager: PluginManager,
): T {
  if (Array.isArray(config)) {
    return config.map(item =>
      normalizeAdapterSnapshots(item, pluginManager),
    ) as T
  }
  if (typeof config === 'object' && config !== null) {
    const record = config as Record<string, unknown>
    // `type` names a track, a display and an adapter alike, so this asks
    // whether the name is an adapter rather than demanding that it is —
    // getAdapterType throws on a miss, and 'AlignmentsTrack' is a miss
    const normalize =
      typeof record.type === 'string' &&
      pluginManager.hasAdapterType(record.type)
        ? pluginManager.getAdapterType(record.type).normalizeSnapshot
        : undefined
    const normalized = normalize?.(record) ?? record
    // Every normalizeSnapshot returns its argument unchanged when there was no
    // shorthand to expand, so identity is the signal that `uri` was consumed —
    // and it then has to GO. The same function runs again as the config
    // schema's preProcessSnapshot when MST builds the tree, and a surviving
    // `uri` makes that second pass rebuild the location from the string,
    // overwriting the BlobLocation just substituted into it. That failure is
    // invisible: the track ends up pointing at a relative URL named
    // `volvox-sorted.bam`, which 404s against the host page's own origin.
    const expanded =
      normalized === record
        ? record
        : Object.fromEntries(
            Object.entries(normalized).filter(([key]) => key !== 'uri'),
          )
    return Object.fromEntries(
      Object.entries(expanded).map(([key, value]) => [
        key,
        normalizeAdapterSnapshots(value, pluginManager),
      ]),
    ) as T
  }
  return config
}

/**
 * Rewrite every `{ uri: <a registered name> }` in a track config to that file's
 * `BlobLocation`, in place of nothing else — unregistered URIs are left alone,
 * so a config can mix local and remote files freely.
 *
 * Runs on a config whose locations are already canonical, which is what
 * `guessTrackConf` (for a loose track spec) and {@link normalizeAdapterSnapshots}
 * (for a written-out one) each produce. So a host registers `peaks.bed.gz` and
 * `peaks.bed.gz.tbi` under their plain names, the config names both under
 * `bedGzLocation` and `index.location`, and this swaps both for blobs — index
 * and all, with no host-side knowledge of which adapter wanted which sibling.
 */
export function resolveLocalFileUris<T>(
  config: T,
  locations: Record<string, BlobLocation>,
): T {
  if (Array.isArray(config)) {
    return config.map(item => resolveLocalFileUris(item, locations)) as T
  }
  if (typeof config === 'object' && config !== null) {
    const record = config as Record<string, unknown>
    const uri = record.uri
    // the whole location node is replaced: a BlobLocation carries blobId and
    // its own locationType, and leaving the old uri alongside would make it
    // fail isBlobLocation's discrimination. Only a *location* node, though — a
    // shorthand adapter also has a `uri`, and replacing that node discards the
    // adapter's type and every sibling key, which the config schema then papers
    // over with its `/path/to/my.bam` default: a track that loads nothing, with
    // nothing logged. normalizeAdapterSnapshots is what turns the shorthand
    // into a location node so this substitutes it.
    if (typeof uri === 'string' && locations[uri] && isLocationNode(record)) {
      return locations[uri] as T
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        resolveLocalFileUris(value, locations),
      ]),
    ) as T
  }
  return config
}
