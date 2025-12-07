import { open } from 'fs/promises'
import path from 'path'

import { createRemoteStream, isURL } from './types/common'

export async function getLocalOrRemoteStream(uri: string, out: string) {
  if (isURL(uri)) {
    const result = await createRemoteStream(uri)
    return {
      totalBytes: +(result.headers.get('Content-Length') || 0),
      stream: result.body,
    }
  } else {
    const filename = path.isAbsolute(uri) ? uri : path.join(out, uri)
    const handle = await open(filename, 'r')
    const stat = await handle.stat()
    return {
      totalBytes: stat.size,
      stream: handle.readableWebStream() as ReadableStream<Uint8Array>,
    }
  }
}

export function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}
