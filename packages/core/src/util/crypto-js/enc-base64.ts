//@ts-nocheck
// CryptoJS Base64 encoding - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

import CryptoJS, {
  WordArray,
  type WordArrayInstance,
  type Encoder,
} from './core.ts'

function parseLoop(
  base64Str: string,
  base64StrLength: number,
  reverseMap: number[],
) {
  const words: number[] = []
  let nBytes = 0
  for (let i = 0; i < base64StrLength; i++) {
    if (i % 4) {
      const bits1 = reverseMap[base64Str.charCodeAt(i - 1)]! << ((i % 4) * 2)
      const bits2 = reverseMap[base64Str.charCodeAt(i)]! >>> (6 - (i % 4) * 2)
      const bitsCombined = bits1 | bits2
      words[nBytes >>> 2] |= bitsCombined << (24 - (nBytes % 4) * 8)
      nBytes++
    }
  }
  // @ts-expect-error
  return new WordArray.init(words, nBytes)
}

const Base64: Encoder & { _map: string; _reverseMap?: number[] } = {
  stringify(wordArray: WordArrayInstance) {
    const words = wordArray.words
    const sigBytes = wordArray.sigBytes
    const map = this._map

    wordArray.clamp()

    const base64Chars: string[] = []
    for (let i = 0; i < sigBytes; i += 3) {
      const byte1 = (words[i >>> 2]! >>> (24 - (i % 4) * 8)) & 0xff
      const byte2 = (words[(i + 1) >>> 2]! >>> (24 - ((i + 1) % 4) * 8)) & 0xff
      const byte3 = (words[(i + 2) >>> 2]! >>> (24 - ((i + 2) % 4) * 8)) & 0xff

      const triplet = (byte1 << 16) | (byte2 << 8) | byte3

      for (let j = 0; j < 4 && i + j * 0.75 < sigBytes; j++) {
        base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f))
      }
    }

    const paddingChar = map.charAt(64)
    if (paddingChar) {
      while (base64Chars.length % 4) {
        base64Chars.push(paddingChar)
      }
    }

    return base64Chars.join('')
  },

  parse(base64Str: string) {
    let base64StrLength = base64Str.length
    const map = this._map
    let reverseMap = this._reverseMap

    if (!reverseMap) {
      reverseMap = this._reverseMap = []
      for (let j = 0; j < map.length; j++) {
        reverseMap[map.charCodeAt(j)] = j
      }
    }

    const paddingChar = map.charAt(64)
    if (paddingChar) {
      const paddingIndex = base64Str.indexOf(paddingChar)
      if (paddingIndex !== -1) {
        base64StrLength = paddingIndex
      }
    }

    return parseLoop(base64Str, base64StrLength, reverseMap)
  },

  _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
}

// Add to CryptoJS
// @ts-expect-error
CryptoJS.enc.Base64 = Base64

export default Base64
export { Base64 }
