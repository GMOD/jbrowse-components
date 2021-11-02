import fs from 'fs'
import split2 from 'split2'
import pump from 'pump'
import { Readable, Transform } from 'stream'
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

// creates an FAI file from a FASTA file streaming in
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

  _transform(chunk: Buffer, encoding: unknown, done: (error?: Error) => void) {
    const line = chunk.toString()
    // line length in bytes including the \n that we split on
    const currentLineBytes = chunk.length + 1
    // chop off \r if exists
    const currentLineBases = line.trim().length
    if (line[0] === '>') {
      this.foundAny = true
      if (
        this.possibleBadLine &&
        this.possibleBadLine[0] !== this.lineNum - 1
      ) {
        done(new Error(this.possibleBadLine[1]))
        return
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
      this.possibleBadLine = undefined
    } else {
      if (this.lineBases && currentLineBases !== this.lineBases) {
        this.possibleBadLine = [
          this.lineNum,
          `Not all lines in file have same width, please check your FASTA file line ${this.lineNum}`,
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

  _flush(done: (error?: Error) => void) {
    if (!this.foundAny) {
      done(
        new Error(
          'No sequences found in file. Ensure that this is a valid FASTA file',
        ),
      )
    } else {
      if (this.lineNum > 0) {
        this.push(
          `${this.refName}\t${this.refSeqLen}\t${this.refOffset}\t${this.lineBases}\t${this.lineBytes}\n`,
        )
      }
      done()
    }
  }
}

export async function generateFastaIndex(
  faiPath: string,
  fileDataStream: Readable,
) {
  return new Promise((resolve, reject) => {
    pump(
      fileDataStream,
      split2(/\n/),
      new FastaIndexTransform(),
      fs.createWriteStream(faiPath),
      function (err) {
        if (err) {
          reject(err)
        } else {
          resolve('success')
        }
      },
    )
  })
}
