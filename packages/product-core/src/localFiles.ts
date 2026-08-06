import { storeBlobLocation } from '@jbrowse/core/util'

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

/**
 * Rewrite every `{ uri: <a registered name> }` in a track config to that file's
 * `BlobLocation`, in place of nothing else — unregistered URIs are left alone,
 * so a config can mix local and remote files freely.
 *
 * Runs *after* type inference rather than instead of it: `guessTrackConf` reads
 * the extension off the uri string to pick the adapter, and derives the index's
 * location as a conventional sibling (`.tbi`/`.bai`/`.crai`) of that same
 * string. So a host registers `peaks.bed.gz` and `peaks.bed.gz.tbi` under their
 * plain names, the guesser produces a BedTabixAdapter pointing at both, and this
 * swaps both for blobs — index and all, with no host-side knowledge of which
 * adapter wanted which sibling.
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
    if (typeof uri === 'string' && locations[uri]) {
      // the whole location node is replaced: a BlobLocation carries blobId and
      // its own locationType, and leaving the old uri alongside would make it
      // fail isBlobLocation's discrimination
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
