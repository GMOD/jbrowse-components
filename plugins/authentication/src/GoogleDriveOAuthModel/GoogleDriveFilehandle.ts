import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'

import type { RequestInitWithMetadata } from './model.tsx'
import type { Stats } from 'generic-filehandle2'

export class GoogleDriveFile extends RemoteFileWithRangeCache {
  private statsPromise: Promise<Stats> | undefined

  // Override to widen opts type so metadataOnly can be passed through to getFetcher
  async fetch(
    input: RequestInfo,
    opts?: RequestInitWithMetadata,
  ): Promise<Response> {
    return super.fetch(input, opts)
  }

  // Fetched on demand rather than from the constructor: openLocation builds a
  // filehandle for every file a track opens and most are read by byte range
  // only, so an eager metadata request cost a round trip (and a token
  // validation) per handle for a size nobody asked for.
  async stat(): Promise<Stats> {
    this.statsPromise ??= this.fetch(this.url, { metadataOnly: true })
      .then(response => response.json() as Promise<{ size: string }>)
      // Drive serializes its int64 fields as JSON strings, so `size` arrives as
      // "12345" — passed on untouched it satisfies `Stats` in name only, and
      // the first caller to do arithmetic on it concatenates instead
      .then(({ size }) => {
        const stats = { size: Number(size) }
        // This is the only place the size of a Drive file is ever observed: the
        // metadata request carries no Content-Range, so the chunk cache's own
        // way of learning it never fires here, and without it every bgzf
        // reader's deliberate over-read of the final block goes to the network
        // to be refused. Drive omits `size` for a file that has none, and
        // recordSize drops the NaN that produces rather than caching it.
        this.recordSize(stats.size)
        return stats
      })
      // a cached rejection is permanent, so one dropped request would take
      // every later stat() of this file with it
      .catch((error: unknown) => {
        this.statsPromise = undefined
        throw error
      })
    return this.statsPromise
  }
}
