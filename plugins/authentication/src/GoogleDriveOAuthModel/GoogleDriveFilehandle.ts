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
      .then(({ size }) => ({ size: Number(size) }))
    return this.statsPromise
  }
}
