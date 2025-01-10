import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'

import type { FilehandleOptions, Stats } from 'generic-filehandle2'

export interface RequestInitWithMetadata extends RequestInit {
  metadataOnly?: boolean
}

interface GoogleDriveFilehandleOptions extends FilehandleOptions {
  fetch(input: RequestInfo, opts?: RequestInitWithMetadata): Promise<Response>
}

export class GoogleDriveFile extends RemoteFileWithRangeCache {
  private statsPromise: Promise<{ size: number }>
  constructor(source: string, opts: GoogleDriveFilehandleOptions) {
    super(source, opts)
    this.statsPromise = this.fetch(source, {
      metadataOnly: true,
    }).then(response => response.json())
  }

  async fetch(
    input: RequestInfo,
    opts?: RequestInitWithMetadata,
  ): Promise<Response> {
    return super.fetch(input, opts)
  }

  async stat(): Promise<Stats> {
    return this.statsPromise
  }
}
