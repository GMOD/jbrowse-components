import readline from 'readline'
import fs from 'fs'
import { Readable } from 'stream'
import { IncomingMessage } from 'http'
import { http, https, FollowResponse } from 'follow-redirects'

// Method for handing off the parsing of a gff3 file URL.
// Calls the proper parser depending on if it is gzipped or not.
// Returns a @gmod/gff stream.
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

export async function generateFastaIndex(fileDataStream: Readable) {
  const rl = readline.createInterface({
    input: fileDataStream,
  })

  let refName: string | undefined
  let currOffset = 0
  let refSeqLen = 0
  let lineBytes = 0
  let lineBases = 0
  let refOffset = currOffset
  const entries = []
  let possibleBadLine = undefined as [number, string] | undefined
  let i = 0
  let foundAny = false

  for await (const line of rl) {
    // assumes unix formatted files with only one '\n' newline
    const currentLineBytes = line.length + 1
    const currentLineBases = line.length
    if (line[0] === '>') {
      foundAny = true
      if (possibleBadLine && possibleBadLine[0] !== i - 1) {
        throw new Error(possibleBadLine[1])
      }
      if (i > 0) {
        entries.push(
          `${refName}\t${refSeqLen}\t${refOffset}\t${lineBases}\t${lineBytes}\n`,
        )
      }
      // reset
      lineBytes = 0
      refSeqLen = 0
      lineBases = 0
      refName = line.trim().slice(1).split(/\s+/)[0]
      currOffset += currentLineBytes
      refOffset = currOffset
    } else {
      if (lineBases && currentLineBases !== lineBases) {
        possibleBadLine = [
          i,
          `Not all lines in file have same width, please check your FASTA file line ${i}: ${lineBases} ${currentLineBases}`,
        ]
      }
      lineBytes = currentLineBytes
      lineBases = currentLineBases
      currOffset += currentLineBytes
      refSeqLen += currentLineBases
    }

    i++
  }

  if (i > 0) {
    entries.push(
      `${refName}\t${refSeqLen}\t${refOffset}\t${lineBases}\t${lineBytes}`,
    )
  }
  if (!foundAny) {
    throw new Error('No sequences found in file, ensure this is a FASTA file')
  }
  return entries.join('\n')
}
