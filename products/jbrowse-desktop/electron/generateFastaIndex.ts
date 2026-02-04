import fs from 'fs'
import { Readable } from 'stream'

async function* readWebStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  try {
    let result = await reader.read()
    while (!result.done) {
      yield result.value
      result = await reader.read()
    }
  } finally {
    reader.releaseLock()
  }
}

export async function getFileStream(
  location: { uri: string } | { localPath: string },
) {
  if ('localPath' in location) {
    return fs.createReadStream(location.localPath)
  }
  if ('uri' in location) {
    const response = await fetch(location.uri)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${location.uri} status ${response.status} ${response.statusText}`,
      )
    }
    if (!response.body) {
      throw new Error(`No response body for ${location.uri}`)
    }
    return Readable.from(readWebStream(response.body))
  }
  throw new Error(`Unknown file handle type ${JSON.stringify(location)}`)
}
