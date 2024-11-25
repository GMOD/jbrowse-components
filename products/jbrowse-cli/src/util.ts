import fs from 'fs'
import path from 'path'
import { isURL, createRemoteStream } from './types/common'

export async function getLocalOrRemoteStream(uri: string, out: string) {
  if (isURL(uri)) {
    const result = await createRemoteStream(uri)
    return {
      totalBytes: +(result.headers.get('Content-Length') || 0),
      stream: result.body,
    }
  } else {
    const filename = path.isAbsolute(uri) ? uri : path.join(out, uri)
    return {
      totalBytes: fs.statSync(filename).size,
      stream: fs.createReadStream(filename),
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
