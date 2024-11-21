import fs from 'fs'
import fetch from 'node-fetch'

// Method for handing off the parsing of a gff3 file URL.
// Calls the proper parser depending on if it is gzipped or not.
// Returns a @gmod/gff stream.
export async function createRemoteStream(urlIn: string) {
  const response = await fetch(urlIn)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${response.status} ${response.statusText}`,
    )
  }
  return response
}

export async function getFileStream(
  location: { uri: string } | { localPath: string },
) {
  let filename: string

  if ('localPath' in location) {
    filename = location.localPath
    return fs.createReadStream(filename)
  } else if ('uri' in location) {
    filename = location.uri
    const temp = await createRemoteStream(filename)
    return temp.body
  } else {
    throw new Error(`Unknown file handle type ${JSON.stringify(location)}`)
  }
}
