import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'

import { createRemoteStream, isURL } from './types/common.ts'

export async function getLocalOrRemoteStream(uri: string, out: string) {
  if (isURL(uri)) {
    const result = await createRemoteStream(uri)
    return {
      totalBytes: +(result.headers.get('Content-Length') || 0),
      stream: result.body,
    }
  } else {
    const filename = path.isAbsolute(uri) ? uri : path.join(out, uri)
    const stats = await stat(filename)
    const nodeStream = createReadStream(filename)
    return {
      totalBytes: stats.size,
      stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
    }
  }
}

export function decodeURIComponentNoThrow(uri: string) {
  if (!uri.includes('%')) {
    return uri
  }
  try {
    return decodeURIComponent(uri)
  } catch {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}
