import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'
import type {
  FilehandleOptions,
  Stats,
  PolyfilledResponse,
} from 'generic-filehandle'

export interface RequestInitWithMetadata extends RequestInit {
  metadataOnly?: boolean
}

interface GoogleDriveFilehandleOptions extends FilehandleOptions {
  fetch(
    input: RequestInfo,
    opts?: RequestInitWithMetadata,
  ): Promise<PolyfilledResponse>
}

export class GoogleDriveFile extends RemoteFileWithRangeCache {
  private statsPromise: Promise<{ size: number }>
  constructor(source: string, opts: GoogleDriveFilehandleOptions) {
    super(source, opts)
    this.statsPromise = this.fetch(source, {
      metadataOnly: true,
    }).then((response: Response) => response.json())
  }

  async fetch(
    input: RequestInfo,
    opts?: RequestInitWithMetadata,
  ): Promise<PolyfilledResponse> {
    return super.fetch(input, opts)
  }

  async stat(): Promise<Stats> {
    return this.statsPromise
  }
}
