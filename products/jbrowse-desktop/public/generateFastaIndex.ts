import fs from 'fs'
import split2 from 'split2'
import { promisify } from 'util'
import { finished, Readable, Transform } from 'stream'
import { IncomingMessage } from 'http'
import { http, https, FollowResponse } from 'follow-redirects'

const streamFinished = promisify(finished)

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

class FastaIndexTransform extends Transform {
  foundAny = false
  possibleBadLine = undefined as [number, string] | undefined
  refName: string | undefined
  currOffset = 0
  refSeqLen = 0
  lineBytes = 0
  lineBases = 0
  refOffset = 0
  lineNum = 0

  _transform(chunk: Buffer, encoding: any, done: () => void) {
    const line = chunk.toString()
    const currentLineBytes =
      line.indexOf('\r') !== -1 ? line.length + 2 : line.length + 1
    const currentLineBases = line.length
    if (line[0] === '>') {
      this.foundAny = true
      if (
        this.possibleBadLine &&
        this.possibleBadLine[0] !== this.lineNum - 1
      ) {
        throw new Error(this.possibleBadLine[1])
      }
      if (this.lineNum > 0) {
        this.push(
          `${this.refName}\t${this.refSeqLen}\t${this.refOffset}\t${this.lineBases}\t${this.lineBytes}\n`,
        )
      }
      // reset
      this.lineBytes = 0
      this.refSeqLen = 0
      this.lineBases = 0
      this.refName = line.trim().slice(1).split(/\s+/)[0]
      this.currOffset += currentLineBytes
      this.refOffset = this.currOffset
    } else {
      if (this.lineBases && currentLineBases !== this.lineBases) {
        this.possibleBadLine = [
          this.lineNum,
          `Not all lines in file have same width, please check your FASTA file line ${this.lineNum}: ${this.lineBases} ${currentLineBases}`,
        ]
      }
      this.lineBytes = currentLineBytes
      this.lineBases = currentLineBases
      this.currOffset += currentLineBytes
      this.refSeqLen += currentLineBases
    }

    this.lineNum++
    done()
  }

  _flush(done: () => void) {
    if (!this.foundAny) {
      throw new Error('No entries found')
    }
    if (this.lineNum > 0) {
      this.push(
        `${this.refName}\t${this.refSeqLen}\t${this.refOffset}\t${this.lineBases}\t${this.lineBytes}\n`,
      )
    }
    done()
  }
}

export async function generateFastaIndex(
  faiPath: string,
  fileDataStream: Readable,
) {
  const out = fs.createWriteStream(faiPath)

  fileDataStream.pipe(split2(/\n/)).pipe(new FastaIndexTransform()).pipe(out)

  await new Promise(resolve => out.on('close', resolve))
}
