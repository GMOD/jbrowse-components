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
    Object.entries(files).map(([name, data]) => [
      name,
      storeBlobLocation({
        blob: data instanceof File ? data : new File([data], name),
      }) as BlobLocation,
    ]),
  )
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
