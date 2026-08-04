// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

export default class BinaryParser {
  position = 0
  private view: DataView
  private length: number
  private littleEndian: boolean

  constructor(dataView: DataView, littleEndian = true) {
    this.view = dataView
    this.length = dataView.byteLength
    this.littleEndian = littleEndian
  }

  available() {
    return this.length - this.position
  }

  getByte() {
    const ret = this.view.getUint8(this.position)
    this.position += 1
    return ret
  }

  getShort() {
    const ret = this.view.getInt16(this.position, this.littleEndian)
    this.position += 2
    return ret
  }

  getInt() {
    const ret = this.view.getInt32(this.position, this.littleEndian)
    this.position += 4
    return ret
  }

  // No native 64-bit read that lands in a `number`, so compose two 32-bit words
  // (deliberately not getBigUint64 — every caller is a file offset or a count
  // that stays well inside Number.MAX_SAFE_INTEGER, and a BigInt would have to
  // be converted back at each use site). hic-straw accumulated byte-by-byte
  // through a throwaway 8-element array, which is a per-entry allocation in the
  // block-index parse loop.
  getLong() {
    const p = this.position
    const le = this.littleEndian
    const first = this.view.getUint32(p, le)
    const second = this.view.getUint32(p + 4, le)
    this.position += 8
    // little-endian puts the low word first, big-endian the high word
    return le ? second * 0x1_0000_0000 + first : first * 0x1_0000_0000 + second
  }

  getString() {
    let s = ''
    let c = this.view.getUint8(this.position++)
    while (c !== 0) {
      s += String.fromCharCode(c)
      c = this.view.getUint8(this.position++)
    }
    return s
  }

  getFloat() {
    const ret = this.view.getFloat32(this.position, this.littleEndian)
    this.position += 4
    return ret
  }

  getDouble() {
    const ret = this.view.getFloat64(this.position, this.littleEndian)
    this.position += 8
    return ret
  }

  skip(n: number) {
    this.position += n
    return this.position
  }
}
