import fs from 'fs'
import { Readable } from 'stream'
import { IncomingMessage } from 'http'
import { http, https, FollowResponse } from 'follow-redirects'

export async function createRemoteStream(urlIn: string) {
  const newUrl = new URL(urlIn)
  const fetcher = newUrl.protocol === 'https:' ? https : http

  return new Promise<IncomingMessage & FollowResponse>((resolve, reject) =>
    fetcher.get(urlIn, resolve).on('error', reject),
  )
}

export async function getFileStream(
  location: { uri: string } | { localPath: string },
) {
  let fileDataStream: Readable
  // marked as unsed, could be used for progress bar though
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let totalBytes = 0
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let receivedBytes = 0
  let filename: string

  if ('localPath' in location) {
    filename = location.localPath
    totalBytes = fs.statSync(filename).size
    fileDataStream = fs.createReadStream(filename)
  } else if ('uri' in location) {
    filename = location.uri
    const temp = await createRemoteStream(filename)
    totalBytes = +(temp.headers['content-length'] || 0)
    fileDataStream = temp
  } else {
    throw new Error(`Unknown file handle type ${JSON.stringify(location)}`)
  }

  fileDataStream.on('data', chunk => {
    receivedBytes += chunk.length
  })
  return fileDataStream
}
