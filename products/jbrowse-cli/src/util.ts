import { isURL, createRemoteStream } from './types/common'
import fs from 'fs'
import path from 'path'

export async function getLocalOrRemoteStream(uri: string, out: string) {
  let stream
  let totalBytes = 0
  if (isURL(uri)) {
    const result = await createRemoteStream(uri)
    totalBytes = +(result.headers['content-length'] || 0)
    stream = result.body
  } else {
    const filename = path.isAbsolute(uri) ? uri : path.join(out, uri)
    totalBytes = fs.statSync(filename).size
    stream = fs.createReadStream(filename)
  }
  return { totalBytes, stream }
}
