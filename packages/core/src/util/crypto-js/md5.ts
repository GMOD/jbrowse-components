//@ts-nocheck
// CryptoJS MD5 - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

import CryptoJS, { WordArray, Hasher } from './core.ts'

const T: number[] = []
for (let i = 0; i < 64; i++) {
  T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0
}

function FF(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  const n = a + ((b & c) | (~b & d)) + x + t
  return ((n << s) | (n >>> (32 - s))) + b
}

function GG(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  const n = a + ((b & d) | (c & ~d)) + x + t
  return ((n << s) | (n >>> (32 - s))) + b
}

function HH(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  const n = a + (b ^ c ^ d) + x + t
  return ((n << s) | (n >>> (32 - s))) + b
}

function II(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  t: number,
) {
  const n = a + (c ^ (b | ~d)) + x + t
  return ((n << s) | (n >>> (32 - s))) + b
}

const MD5 = Hasher.extend({
  _doReset() {
    // @ts-expect-error
    this._hash = new WordArray.init([
      0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476,
    ])
  },

  _doProcessBlock(M: number[], offset: number) {
    for (let i = 0; i < 16; i++) {
      const offset_i = offset + i
      const M_offset_i = M[offset_i]!

      M[offset_i] =
        (((M_offset_i << 8) | (M_offset_i >>> 24)) & 0x00ff00ff) |
        (((M_offset_i << 24) | (M_offset_i >>> 8)) & 0xff00ff00)
    }

    // @ts-expect-error
    const H = this._hash.words

    const M_offset_0 = M[offset + 0]!
    const M_offset_1 = M[offset + 1]!
    const M_offset_2 = M[offset + 2]!
    const M_offset_3 = M[offset + 3]!
    const M_offset_4 = M[offset + 4]!
    const M_offset_5 = M[offset + 5]!
    const M_offset_6 = M[offset + 6]!
    const M_offset_7 = M[offset + 7]!
    const M_offset_8 = M[offset + 8]!
    const M_offset_9 = M[offset + 9]!
    const M_offset_10 = M[offset + 10]!
    const M_offset_11 = M[offset + 11]!
    const M_offset_12 = M[offset + 12]!
    const M_offset_13 = M[offset + 13]!
    const M_offset_14 = M[offset + 14]!
    const M_offset_15 = M[offset + 15]!

    let a = H[0]!
    let b = H[1]!
    let c = H[2]!
    let d = H[3]!

    a = FF(a, b, c, d, M_offset_0, 7, T[0]!)
    d = FF(d, a, b, c, M_offset_1, 12, T[1]!)
    c = FF(c, d, a, b, M_offset_2, 17, T[2]!)
    b = FF(b, c, d, a, M_offset_3, 22, T[3]!)
    a = FF(a, b, c, d, M_offset_4, 7, T[4]!)
    d = FF(d, a, b, c, M_offset_5, 12, T[5]!)
    c = FF(c, d, a, b, M_offset_6, 17, T[6]!)
    b = FF(b, c, d, a, M_offset_7, 22, T[7]!)
    a = FF(a, b, c, d, M_offset_8, 7, T[8]!)
    d = FF(d, a, b, c, M_offset_9, 12, T[9]!)
    c = FF(c, d, a, b, M_offset_10, 17, T[10]!)
    b = FF(b, c, d, a, M_offset_11, 22, T[11]!)
    a = FF(a, b, c, d, M_offset_12, 7, T[12]!)
    d = FF(d, a, b, c, M_offset_13, 12, T[13]!)
    c = FF(c, d, a, b, M_offset_14, 17, T[14]!)
    b = FF(b, c, d, a, M_offset_15, 22, T[15]!)

    a = GG(a, b, c, d, M_offset_1, 5, T[16]!)
    d = GG(d, a, b, c, M_offset_6, 9, T[17]!)
    c = GG(c, d, a, b, M_offset_11, 14, T[18]!)
    b = GG(b, c, d, a, M_offset_0, 20, T[19]!)
    a = GG(a, b, c, d, M_offset_5, 5, T[20]!)
    d = GG(d, a, b, c, M_offset_10, 9, T[21]!)
    c = GG(c, d, a, b, M_offset_15, 14, T[22]!)
    b = GG(b, c, d, a, M_offset_4, 20, T[23]!)
    a = GG(a, b, c, d, M_offset_9, 5, T[24]!)
    d = GG(d, a, b, c, M_offset_14, 9, T[25]!)
    c = GG(c, d, a, b, M_offset_3, 14, T[26]!)
    b = GG(b, c, d, a, M_offset_8, 20, T[27]!)
    a = GG(a, b, c, d, M_offset_13, 5, T[28]!)
    d = GG(d, a, b, c, M_offset_2, 9, T[29]!)
    c = GG(c, d, a, b, M_offset_7, 14, T[30]!)
    b = GG(b, c, d, a, M_offset_12, 20, T[31]!)

    a = HH(a, b, c, d, M_offset_5, 4, T[32]!)
    d = HH(d, a, b, c, M_offset_8, 11, T[33]!)
    c = HH(c, d, a, b, M_offset_11, 16, T[34]!)
    b = HH(b, c, d, a, M_offset_14, 23, T[35]!)
    a = HH(a, b, c, d, M_offset_1, 4, T[36]!)
    d = HH(d, a, b, c, M_offset_4, 11, T[37]!)
    c = HH(c, d, a, b, M_offset_7, 16, T[38]!)
    b = HH(b, c, d, a, M_offset_10, 23, T[39]!)
    a = HH(a, b, c, d, M_offset_13, 4, T[40]!)
    d = HH(d, a, b, c, M_offset_0, 11, T[41]!)
    c = HH(c, d, a, b, M_offset_3, 16, T[42]!)
    b = HH(b, c, d, a, M_offset_6, 23, T[43]!)
    a = HH(a, b, c, d, M_offset_9, 4, T[44]!)
    d = HH(d, a, b, c, M_offset_12, 11, T[45]!)
    c = HH(c, d, a, b, M_offset_15, 16, T[46]!)
    b = HH(b, c, d, a, M_offset_2, 23, T[47]!)

    a = II(a, b, c, d, M_offset_0, 6, T[48]!)
    d = II(d, a, b, c, M_offset_7, 10, T[49]!)
    c = II(c, d, a, b, M_offset_14, 15, T[50]!)
    b = II(b, c, d, a, M_offset_5, 21, T[51]!)
    a = II(a, b, c, d, M_offset_12, 6, T[52]!)
    d = II(d, a, b, c, M_offset_3, 10, T[53]!)
    c = II(c, d, a, b, M_offset_10, 15, T[54]!)
    b = II(b, c, d, a, M_offset_1, 21, T[55]!)
    a = II(a, b, c, d, M_offset_8, 6, T[56]!)
    d = II(d, a, b, c, M_offset_15, 10, T[57]!)
    c = II(c, d, a, b, M_offset_6, 15, T[58]!)
    b = II(b, c, d, a, M_offset_13, 21, T[59]!)
    a = II(a, b, c, d, M_offset_4, 6, T[60]!)
    d = II(d, a, b, c, M_offset_11, 10, T[61]!)
    c = II(c, d, a, b, M_offset_2, 15, T[62]!)
    b = II(b, c, d, a, M_offset_9, 21, T[63]!)

    H[0] = (H[0]! + a) | 0
    H[1] = (H[1]! + b) | 0
    H[2] = (H[2]! + c) | 0
    H[3] = (H[3]! + d) | 0
  },

  _doFinalize() {
    // @ts-expect-error
    const data = this._data
    const dataWords = data.words
    // @ts-expect-error
    const nBitsTotal = this._nDataBytes * 8
    const nBitsLeft = data.sigBytes * 8

    dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32))

    const nBitsTotalH = Math.floor(nBitsTotal / 0x100000000)
    const nBitsTotalL = nBitsTotal
    dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] =
      (((nBitsTotalH << 8) | (nBitsTotalH >>> 24)) & 0x00ff00ff) |
      (((nBitsTotalH << 24) | (nBitsTotalH >>> 8)) & 0xff00ff00)
    dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] =
      (((nBitsTotalL << 8) | (nBitsTotalL >>> 24)) & 0x00ff00ff) |
      (((nBitsTotalL << 24) | (nBitsTotalL >>> 8)) & 0xff00ff00)

    data.sigBytes = (dataWords.length + 1) * 4

    // @ts-expect-error
    this._process()

    // @ts-expect-error
    const hash = this._hash
    const H = hash.words

    for (let i = 0; i < 4; i++) {
      const H_i = H[i]!
      H[i] =
        (((H_i << 8) | (H_i >>> 24)) & 0x00ff00ff) |
        (((H_i << 24) | (H_i >>> 8)) & 0xff00ff00)
    }

    return hash
  },

  clone() {
    const clone = Hasher.clone.call(this)
    // @ts-expect-error
    clone._hash = this._hash.clone()
    return clone
  },
})

// @ts-expect-error
const MD5Func = Hasher._createHelper(MD5)

// Add to CryptoJS
CryptoJS.algo.MD5 = MD5
// @ts-expect-error
CryptoJS.MD5 = MD5Func

export default MD5
export { MD5, MD5Func }
