import fs from 'fs'
import readline from 'readline'
import { createGunzip } from 'zlib'

export function getReadline(filename: string): readline.Interface {
  const stream = fs.createReadStream(filename)
  return readline.createInterface({
    input: /.b?gz$/.exec(filename) ? stream.pipe(createGunzip()) : stream,
  })
}

export function getStdReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
  })
}

export interface WritableStream {
  write: (arg: string) => boolean
  once?: (event: string, handler: () => void) => void
  removeListener?: (event: string, handler: () => void) => void
}

export function createWriteWithBackpressure(stream: WritableStream) {
  return (data: string): Promise<void> => {
    // If the stream buffer is full (write returns false), we need to wait for drain
    if (!stream.write(data)) {
      return new Promise(resolve => {
        const drainHandler = () => {
          stream.removeListener?.('drain', drainHandler)
          resolve()
        }
        stream.once?.('drain', drainHandler)
      })
    }
    // If write returns true, the buffer is not full, so we can continue immediately
    return Promise.resolve()
  }
}
