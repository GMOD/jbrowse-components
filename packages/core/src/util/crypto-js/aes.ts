//@ts-nocheck
// CryptoJS AES - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

import CryptoJS from './core.ts'
import { BlockCipher } from './cipher-core.ts'

const SBOX: number[] = []
const INV_SBOX: number[] = []
const SUB_MIX_0: number[] = []
const SUB_MIX_1: number[] = []
const SUB_MIX_2: number[] = []
const SUB_MIX_3: number[] = []
const INV_SUB_MIX_0: number[] = []
const INV_SUB_MIX_1: number[] = []
const INV_SUB_MIX_2: number[] = []
const INV_SUB_MIX_3: number[] = []

// Compute lookup tables
;(() => {
  const d: number[] = []
  for (let i = 0; i < 256; i++) {
    if (i < 128) {
      d[i] = i << 1
    } else {
      d[i] = (i << 1) ^ 0x11b
    }
  }

  let x = 0
  let xi = 0
  for (let i = 0; i < 256; i++) {
    let sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4)
    sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63
    SBOX[x] = sx
    INV_SBOX[sx] = x

    const x2 = d[x]!
    const x4 = d[x2]!
    const x8 = d[x4]!

    let t = (d[sx]! * 0x101) ^ (sx * 0x1010100)
    SUB_MIX_0[x] = (t << 24) | (t >>> 8)
    SUB_MIX_1[x] = (t << 16) | (t >>> 16)
    SUB_MIX_2[x] = (t << 8) | (t >>> 24)
    SUB_MIX_3[x] = t

    t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100)
    INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8)
    INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16)
    INV_SUB_MIX_2[sx] = (t << 8) | (t >>> 24)
    INV_SUB_MIX_3[sx] = t

    if (!x) {
      x = xi = 1
    } else {
      x = x2 ^ d[d[d[x8 ^ x2]!]!]!
      xi ^= d[d[xi]!]!
    }
  }
})()

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]

const AES = BlockCipher.extend({
  _doReset() {
    // @ts-expect-error
    if (this._nRounds && this._keyPriorReset === this._key) {
      return
    }

    // @ts-expect-error
    const key = (this._keyPriorReset = this._key)
    const keyWords = key.words
    const keySize = key.sigBytes / 4

    // @ts-expect-error
    const nRounds = (this._nRounds = keySize + 6)
    const ksRows = (nRounds + 1) * 4

    // @ts-expect-error
    const keySchedule = (this._keySchedule = [])
    for (let ksRow = 0; ksRow < ksRows; ksRow++) {
      if (ksRow < keySize) {
        keySchedule[ksRow] = keyWords[ksRow]
      } else {
        let t = keySchedule[ksRow - 1]!

        if (!(ksRow % keySize)) {
          t = (t << 8) | (t >>> 24)
          t =
            (SBOX[t >>> 24]! << 24) |
            (SBOX[(t >>> 16) & 0xff]! << 16) |
            (SBOX[(t >>> 8) & 0xff]! << 8) |
            SBOX[t & 0xff]!
          t ^= RCON[(ksRow / keySize) | 0]! << 24
        } else if (keySize > 6 && ksRow % keySize === 4) {
          t =
            (SBOX[t >>> 24]! << 24) |
            (SBOX[(t >>> 16) & 0xff]! << 16) |
            (SBOX[(t >>> 8) & 0xff]! << 8) |
            SBOX[t & 0xff]!
        }

        keySchedule[ksRow] = keySchedule[ksRow - keySize]! ^ t
      }
    }

    // @ts-expect-error
    const invKeySchedule = (this._invKeySchedule = [])
    for (let invKsRow = 0; invKsRow < ksRows; invKsRow++) {
      const ksRow = ksRows - invKsRow

      let t
      if (invKsRow % 4) {
        t = keySchedule[ksRow]!
      } else {
        t = keySchedule[ksRow - 4]!
      }

      if (invKsRow < 4 || ksRow <= 4) {
        invKeySchedule[invKsRow] = t
      } else {
        invKeySchedule[invKsRow] =
          INV_SUB_MIX_0[SBOX[t >>> 24]!]! ^
          INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]!]! ^
          INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]!]! ^
          INV_SUB_MIX_3[SBOX[t & 0xff]!]!
      }
    }
  },

  encryptBlock(M: number[], offset: number) {
    // @ts-expect-error
    this._doCryptBlock(
      M,
      offset,
      // @ts-expect-error
      this._keySchedule,
      SUB_MIX_0,
      SUB_MIX_1,
      SUB_MIX_2,
      SUB_MIX_3,
      SBOX,
    )
  },

  decryptBlock(M: number[], offset: number) {
    let t = M[offset + 1]
    M[offset + 1] = M[offset + 3]
    M[offset + 3] = t

    // @ts-expect-error
    this._doCryptBlock(
      M,
      offset,
      // @ts-expect-error
      this._invKeySchedule,
      INV_SUB_MIX_0,
      INV_SUB_MIX_1,
      INV_SUB_MIX_2,
      INV_SUB_MIX_3,
      INV_SBOX,
    )

    t = M[offset + 1]
    M[offset + 1] = M[offset + 3]
    M[offset + 3] = t
  },

  _doCryptBlock(
    M: number[],
    offset: number,
    keySchedule: number[],
    SUB_MIX_0: number[],
    SUB_MIX_1: number[],
    SUB_MIX_2: number[],
    SUB_MIX_3: number[],
    SBOX: number[],
  ) {
    // @ts-expect-error
    const nRounds = this._nRounds

    let s0 = M[offset]! ^ keySchedule[0]!
    let s1 = M[offset + 1]! ^ keySchedule[1]!
    let s2 = M[offset + 2]! ^ keySchedule[2]!
    let s3 = M[offset + 3]! ^ keySchedule[3]!

    let ksRow = 4

    for (let round = 1; round < nRounds; round++) {
      const t0 =
        SUB_MIX_0[s0 >>> 24]! ^
        SUB_MIX_1[(s1 >>> 16) & 0xff]! ^
        SUB_MIX_2[(s2 >>> 8) & 0xff]! ^
        SUB_MIX_3[s3 & 0xff]! ^
        keySchedule[ksRow++]!
      const t1 =
        SUB_MIX_0[s1 >>> 24]! ^
        SUB_MIX_1[(s2 >>> 16) & 0xff]! ^
        SUB_MIX_2[(s3 >>> 8) & 0xff]! ^
        SUB_MIX_3[s0 & 0xff]! ^
        keySchedule[ksRow++]!
      const t2 =
        SUB_MIX_0[s2 >>> 24]! ^
        SUB_MIX_1[(s3 >>> 16) & 0xff]! ^
        SUB_MIX_2[(s0 >>> 8) & 0xff]! ^
        SUB_MIX_3[s1 & 0xff]! ^
        keySchedule[ksRow++]!
      const t3 =
        SUB_MIX_0[s3 >>> 24]! ^
        SUB_MIX_1[(s0 >>> 16) & 0xff]! ^
        SUB_MIX_2[(s1 >>> 8) & 0xff]! ^
        SUB_MIX_3[s2 & 0xff]! ^
        keySchedule[ksRow++]!

      s0 = t0
      s1 = t1
      s2 = t2
      s3 = t3
    }

    const t0 =
      ((SBOX[s0 >>> 24]! << 24) |
        (SBOX[(s1 >>> 16) & 0xff]! << 16) |
        (SBOX[(s2 >>> 8) & 0xff]! << 8) |
        SBOX[s3 & 0xff]!) ^
      keySchedule[ksRow++]!
    const t1 =
      ((SBOX[s1 >>> 24]! << 24) |
        (SBOX[(s2 >>> 16) & 0xff]! << 16) |
        (SBOX[(s3 >>> 8) & 0xff]! << 8) |
        SBOX[s0 & 0xff]!) ^
      keySchedule[ksRow++]!
    const t2 =
      ((SBOX[s2 >>> 24]! << 24) |
        (SBOX[(s3 >>> 16) & 0xff]! << 16) |
        (SBOX[(s0 >>> 8) & 0xff]! << 8) |
        SBOX[s1 & 0xff]!) ^
      keySchedule[ksRow++]!
    const t3 =
      ((SBOX[s3 >>> 24]! << 24) |
        (SBOX[(s0 >>> 16) & 0xff]! << 16) |
        (SBOX[(s1 >>> 8) & 0xff]! << 8) |
        SBOX[s2 & 0xff]!) ^
      keySchedule[ksRow++]!

    M[offset] = t0
    M[offset + 1] = t1
    M[offset + 2] = t2
    M[offset + 3] = t3
  },

  keySize: 256 / 32,
})

// @ts-expect-error
const AESLib = BlockCipher._createHelper(AES)

CryptoJS.algo.AES = AES
// @ts-expect-error
CryptoJS.AES = AESLib

export default AES
export { AES, AESLib }
