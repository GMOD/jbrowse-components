//@ts-nocheck
// CryptoJS SHA256 - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

import CryptoJS, { WordArray, Hasher } from './core.ts'

const H: number[] = []
const K: number[] = []

// Compute constants
;(() => {
  function isPrime(n: number) {
    const sqrtN = Math.sqrt(n)
    for (let factor = 2; factor <= sqrtN; factor++) {
      if (!(n % factor)) {
        return false
      }
    }
    return true
  }

  function getFractionalBits(n: number) {
    return ((n - (n | 0)) * 0x100000000) | 0
  }

  let n = 2
  let nPrime = 0
  while (nPrime < 64) {
    if (isPrime(n)) {
      if (nPrime < 8) {
        H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2))
      }
      K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3))
      nPrime++
    }
    n++
  }
})()

const W: number[] = []

const SHA256 = Hasher.extend({
  _doReset() {
    // @ts-expect-error
    this._hash = new WordArray.init(H.slice(0))
  },

  _doProcessBlock(M: number[], offset: number) {
    // @ts-expect-error
    const HH = this._hash.words

    let a = HH[0]!
    let b = HH[1]!
    let c = HH[2]!
    let d = HH[3]!
    let e = HH[4]!
    let f = HH[5]!
    let g = HH[6]!
    let h = HH[7]!

    for (let i = 0; i < 64; i++) {
      if (i < 16) {
        W[i] = M[offset + i]! | 0
      } else {
        const gamma0x = W[i - 15]!
        const gamma0 =
          ((gamma0x << 25) | (gamma0x >>> 7)) ^
          ((gamma0x << 14) | (gamma0x >>> 18)) ^
          (gamma0x >>> 3)

        const gamma1x = W[i - 2]!
        const gamma1 =
          ((gamma1x << 15) | (gamma1x >>> 17)) ^
          ((gamma1x << 13) | (gamma1x >>> 19)) ^
          (gamma1x >>> 10)

        W[i] = gamma0 + W[i - 7]! + gamma1 + W[i - 16]!
      }

      const ch = (e & f) ^ (~e & g)
      const maj = (a & b) ^ (a & c) ^ (b & c)

      const sigma0 =
        ((a << 30) | (a >>> 2)) ^
        ((a << 19) | (a >>> 13)) ^
        ((a << 10) | (a >>> 22))
      const sigma1 =
        ((e << 26) | (e >>> 6)) ^
        ((e << 21) | (e >>> 11)) ^
        ((e << 7) | (e >>> 25))

      const t1 = h + sigma1 + ch + K[i]! + W[i]!
      const t2 = sigma0 + maj

      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }

    HH[0] = (HH[0]! + a) | 0
    HH[1] = (HH[1]! + b) | 0
    HH[2] = (HH[2]! + c) | 0
    HH[3] = (HH[3]! + d) | 0
    HH[4] = (HH[4]! + e) | 0
    HH[5] = (HH[5]! + f) | 0
    HH[6] = (HH[6]! + g) | 0
    HH[7] = (HH[7]! + h) | 0
  },

  _doFinalize() {
    // @ts-expect-error
    const data = this._data
    const dataWords = data.words
    // @ts-expect-error
    const nBitsTotal = this._nDataBytes * 8
    const nBitsLeft = data.sigBytes * 8

    dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32))
    dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(
      nBitsTotal / 0x100000000,
    )
    dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal
    data.sigBytes = dataWords.length * 4

    // @ts-expect-error
    this._process()

    // @ts-expect-error
    return this._hash
  },

  clone() {
    const clone = Hasher.clone.call(this)
    // @ts-expect-error
    clone._hash = this._hash.clone()
    return clone
  },
})

// @ts-expect-error
const SHA256Func = Hasher._createHelper(SHA256)

CryptoJS.algo.SHA256 = SHA256
// @ts-expect-error
CryptoJS.SHA256 = SHA256Func

export default SHA256
export { SHA256, SHA256Func }
