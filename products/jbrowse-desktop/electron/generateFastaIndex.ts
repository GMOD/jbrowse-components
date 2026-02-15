import fs from 'fs'
import { Readable } from 'stream'

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
    const body = response.body
    const reader = body.getReader()
    return new Readable({
      async read() {
        let result = await reader.read()
        while (!result.done) {
          this.push(result.value)
          result = await reader.read()
        }
        this.push(null)
      },
    })
  }
  throw new Error(`Unknown file handle type ${JSON.stringify(location)}`)
}
