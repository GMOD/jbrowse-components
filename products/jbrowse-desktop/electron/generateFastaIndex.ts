import fs from 'fs'

import fetch from 'node-fetch'

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
    return response.body
  }
  throw new Error(`Unknown file handle type ${JSON.stringify(location)}`)
}
