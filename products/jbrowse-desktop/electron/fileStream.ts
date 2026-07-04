import fs from 'node:fs'
import { Readable } from 'node:stream'

export async function getFileStream(
  location: { uri: string } | { localPath: string },
) {
  if ('localPath' in location) {
    return fs.createReadStream(location.localPath)
  }
  const response = await fetch(location.uri)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${location.uri} status ${response.status} ${response.statusText}`,
    )
  }
  if (!response.body) {
    throw new Error(`No response body for ${location.uri}`)
  }
  // Safe here: this runs in the Electron main process, where the global fetch
  // is Node's undici and response.body is genuinely a node:stream/web
  // ReadableStream. The realm mismatch that bans fromWeb elsewhere only happens
  // under Chromium's fetch (renderer/worker). See the no-restricted-syntax rule.
  // eslint-disable-next-line no-restricted-syntax
  return Readable.fromWeb(response.body)
}
