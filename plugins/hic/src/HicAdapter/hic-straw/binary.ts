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

  // DataView has no native 64-bit integer read, so accumulate bytes manually.
  getLong() {
    const b: number[] = []
    for (let i = 0; i < 8; i++) {
      b[i] = this.view.getUint8(this.position + i)
    }
    let value = 0
    if (this.littleEndian) {
      for (let i = b.length - 1; i >= 0; i--) {
        value = value * 256 + b[i]!
      }
    } else {
      for (const byte of b) {
        value = value * 256 + byte
      }
    }
    this.position += 8
    return value
  }

  getString(len?: number) {
    let s = ''
    let c = this.view.getUint8(this.position++)
    while (c !== 0) {
      s += String.fromCharCode(c)
      if (len && s.length === len) {
        break
      }
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
