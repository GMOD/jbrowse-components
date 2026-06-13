// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

import type { Filehandle } from './types.ts'

function concatBuffers(buffer1: ArrayBuffer, buffer2: ArrayBuffer) {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength)
  tmp.set(new Uint8Array(buffer1), 0)
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength)
  return tmp.buffer
}

export default class BufferedFile {
  private file: Filehandle
  private size: number
  private bufferStart = 0
  private bufferLength = 0
  private buffer: ArrayBuffer | undefined

  constructor(args: { file: Filehandle; size?: number }) {
    this.file = args.file
    this.size = args.size ?? 64000
  }

  async read(position: number, length: number): Promise<ArrayBuffer> {
    const start = position
    const end = position + length
    const bufferStart = this.bufferStart
    const bufferEnd = this.bufferStart + this.bufferLength
    const buf = this.buffer

    let result: ArrayBuffer
    if (length > this.size) {
      // Request larger than max buffer size, pass through to underlying file
      this.buffer = undefined
      this.bufferStart = 0
      this.bufferLength = 0
      result = await this.file.read(position, length)
    } else if (buf && start >= bufferStart && end <= bufferEnd) {
      // Request within buffer bounds
      const sliceStart = start - bufferStart
      result = buf.slice(sliceStart, sliceStart + length)
    } else if (buf && start < bufferStart && end > bufferStart) {
      // Overlap left (unexpected in straw); we don't adjust the buffer
      const l1 = bufferStart - start
      const a1 = await this.file.read(position, l1)
      const l2 = length - l1
      if (l2 > 0) {
        result = concatBuffers(a1, buf.slice(0, l2))
      } else {
        result = a1
      }
    } else if (buf && start < bufferEnd && end > bufferEnd) {
      // Overlap right
      const l1 = bufferEnd - start
      const a1 = buf.slice(this.bufferLength - l1, this.bufferLength)
      const l2 = length - l1
      if (l2 > 0) {
        const next = await this.file.read(bufferEnd, this.size)
        this.buffer = next
        this.bufferStart = bufferEnd
        this.bufferLength = next.byteLength
        result = concatBuffers(a1, next.slice(0, l2))
      } else {
        result = a1
      }
    } else {
      // No overlap with buffer
      const next = await this.file.read(position, this.size)
      this.buffer = next
      this.bufferStart = position
      this.bufferLength = next.byteLength
      result = next.slice(0, length)
    }
    return result
  }
}
