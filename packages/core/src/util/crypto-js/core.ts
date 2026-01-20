//@ts-nocheck
// CryptoJS core components - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

const cryptoObj = (() => {
  // Native crypto from window (Browser)
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto
  }
  // Native crypto in web worker (Browser)
  if (typeof self !== 'undefined' && self.crypto) {
    return self.crypto
  }
  // Native crypto from worker
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto
  }
  return undefined
})()

function cryptoSecureRandomInt() {
  if (cryptoObj?.getRandomValues) {
    return cryptoObj.getRandomValues(new Uint32Array(1))[0]!
  }
  throw new Error(
    'Native crypto module could not be used to get secure random number.',
  )
}

const create =
  Object.create ||
  (() => {
    function F() {}
    return (obj: object) => {
      F.prototype = obj
      // @ts-expect-error
      const subtype = new F()
      F.prototype = null
      return subtype
    }
  })()

interface WordArrayInit {
  words: number[]
  sigBytes: number
  init: (words?: number[], sigBytes?: number) => WordArrayInstance
  prototype: WordArrayInstance
}

interface WordArrayInstance {
  words: number[]
  sigBytes: number
  toString: (encoder?: Encoder) => string
  concat: (wordArray: WordArrayInstance) => WordArrayInstance
  clamp: () => void
  clone: () => WordArrayInstance
}

interface Encoder {
  stringify: (wordArray: WordArrayInstance) => string
  parse: (str: string) => WordArrayInstance
}

interface BaseType {
  extend: (overrides?: object) => BaseType
  create: (...args: unknown[]) => BaseType
  init: (...args: unknown[]) => void
  mixIn: (properties: object) => void
  clone: () => BaseType
  $super?: BaseType
}

const Base: BaseType = {
  extend(overrides) {
    const subtype = create(this)
    if (overrides) {
      subtype.mixIn(overrides)
    }
    if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
      subtype.init = function () {
        subtype.$super.init.apply(this, arguments)
      }
    }
    subtype.init.prototype = subtype
    subtype.$super = this
    return subtype
  },

  create() {
    const instance = this.extend()
    instance.init.apply(instance, arguments)
    return instance
  },

  init() {},

  mixIn(properties) {
    for (const propertyName in properties) {
      if (properties.hasOwnProperty(propertyName)) {
        // @ts-expect-error
        this[propertyName] = properties[propertyName]
      }
    }
    // @ts-expect-error
    if (properties.hasOwnProperty('toString')) {
      // @ts-expect-error
      this.toString = properties.toString
    }
  },

  clone() {
    // @ts-expect-error
    return this.init.prototype.extend(this)
  },
}

const WordArray = Base.extend({
  init(words?: number[], sigBytes?: number) {
    // @ts-expect-error
    words = this.words = words || []
    // @ts-expect-error
    this.sigBytes = sigBytes !== undefined ? sigBytes : words.length * 4
  },

  toString(encoder?: Encoder) {
    return (encoder || Hex).stringify(this as unknown as WordArrayInstance)
  },

  concat(wordArray: WordArrayInstance) {
    // @ts-expect-error
    const thisWords = this.words
    const thatWords = wordArray.words
    // @ts-expect-error
    const thisSigBytes = this.sigBytes
    const thatSigBytes = wordArray.sigBytes

    // @ts-expect-error
    this.clamp()

    if (thisSigBytes % 4) {
      for (let i = 0; i < thatSigBytes; i++) {
        const thatByte = (thatWords[i >>> 2]! >>> (24 - (i % 4) * 8)) & 0xff
        thisWords[(thisSigBytes + i) >>> 2] |=
          thatByte << (24 - ((thisSigBytes + i) % 4) * 8)
      }
    } else {
      for (let j = 0; j < thatSigBytes; j += 4) {
        thisWords[(thisSigBytes + j) >>> 2] = thatWords[j >>> 2]
      }
    }
    // @ts-expect-error
    this.sigBytes += thatSigBytes

    return this
  },

  clamp() {
    // @ts-expect-error
    const words = this.words
    // @ts-expect-error
    const sigBytes = this.sigBytes

    words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8)
    words.length = Math.ceil(sigBytes / 4)
  },

  clone() {
    const clone = Base.clone.call(this)
    // @ts-expect-error
    clone.words = this.words.slice(0)
    return clone
  },

  random(nBytes: number) {
    const words: number[] = []
    for (let i = 0; i < nBytes; i += 4) {
      words.push(cryptoSecureRandomInt())
    }
    // @ts-expect-error
    return new WordArray.init(words, nBytes)
  },
})

const Hex: Encoder = {
  stringify(wordArray) {
    const words = wordArray.words
    const sigBytes = wordArray.sigBytes
    const hexChars: string[] = []
    for (let i = 0; i < sigBytes; i++) {
      const bite = (words[i >>> 2]! >>> (24 - (i % 4) * 8)) & 0xff
      hexChars.push((bite >>> 4).toString(16))
      hexChars.push((bite & 0x0f).toString(16))
    }
    return hexChars.join('')
  },

  parse(hexStr) {
    const hexStrLength = hexStr.length
    const words: number[] = []
    for (let i = 0; i < hexStrLength; i += 2) {
      words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4)
    }
    // @ts-expect-error
    return new WordArray.init(words, hexStrLength / 2)
  },
}

const Latin1: Encoder = {
  stringify(wordArray) {
    const words = wordArray.words
    const sigBytes = wordArray.sigBytes
    const latin1Chars: string[] = []
    for (let i = 0; i < sigBytes; i++) {
      const bite = (words[i >>> 2]! >>> (24 - (i % 4) * 8)) & 0xff
      latin1Chars.push(String.fromCharCode(bite))
    }
    return latin1Chars.join('')
  },

  parse(latin1Str) {
    const latin1StrLength = latin1Str.length
    const words: number[] = []
    for (let i = 0; i < latin1StrLength; i++) {
      words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
    }
    // @ts-expect-error
    return new WordArray.init(words, latin1StrLength)
  },
}

const Utf8: Encoder = {
  stringify(wordArray) {
    try {
      return decodeURIComponent(escape(Latin1.stringify(wordArray)))
    } catch (e) {
      throw new Error('Malformed UTF-8 data')
    }
  },

  parse(utf8Str) {
    return Latin1.parse(unescape(encodeURIComponent(utf8Str)))
  },
}

const BufferedBlockAlgorithm = Base.extend({
  reset() {
    // @ts-expect-error
    this._data = new WordArray.init()
    // @ts-expect-error
    this._nDataBytes = 0
  },

  _append(data: WordArrayInstance | string) {
    if (typeof data === 'string') {
      data = Utf8.parse(data)
    }
    // @ts-expect-error
    this._data.concat(data)
    // @ts-expect-error
    this._nDataBytes += data.sigBytes
  },

  _process(doFlush?: boolean) {
    let processedWords
    // @ts-expect-error
    const data = this._data
    const dataWords = data.words
    const dataSigBytes = data.sigBytes
    // @ts-expect-error
    const blockSize = this.blockSize
    const blockSizeBytes = blockSize * 4

    let nBlocksReady = dataSigBytes / blockSizeBytes
    if (doFlush) {
      nBlocksReady = Math.ceil(nBlocksReady)
    } else {
      // @ts-expect-error
      nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0)
    }

    const nWordsReady = nBlocksReady * blockSize
    const nBytesReady = Math.min(nWordsReady * 4, dataSigBytes)

    if (nWordsReady) {
      for (let offset = 0; offset < nWordsReady; offset += blockSize) {
        // @ts-expect-error
        this._doProcessBlock(dataWords, offset)
      }
      processedWords = dataWords.splice(0, nWordsReady)
      data.sigBytes -= nBytesReady
    }

    // @ts-expect-error
    return new WordArray.init(processedWords, nBytesReady)
  },

  clone() {
    const clone = Base.clone.call(this)
    // @ts-expect-error
    clone._data = this._data.clone()
    return clone
  },

  _minBufferSize: 0,
})

const Hasher = BufferedBlockAlgorithm.extend({
  cfg: Base.extend(),

  init(cfg?: object) {
    // @ts-expect-error
    this.cfg = this.cfg.extend(cfg)
    this.reset()
  },

  reset() {
    BufferedBlockAlgorithm.reset.call(this)
    // @ts-expect-error
    this._doReset()
  },

  update(messageUpdate: WordArrayInstance | string) {
    // @ts-expect-error
    this._append(messageUpdate)
    // @ts-expect-error
    this._process()
    return this
  },

  finalize(messageUpdate?: WordArrayInstance | string) {
    if (messageUpdate) {
      // @ts-expect-error
      this._append(messageUpdate)
    }
    // @ts-expect-error
    return this._doFinalize()
  },

  blockSize: 512 / 32,

  _createHelper(hasher: BaseType) {
    return (message: WordArrayInstance | string, cfg?: object) =>
      // @ts-expect-error
      new hasher.init(cfg).finalize(message)
  },

  _createHmacHelper(hasher: BaseType) {
    return (
      message: WordArrayInstance | string,
      key: WordArrayInstance | string,
    ) =>
      // @ts-expect-error
      new HMAC.init(hasher, key).finalize(message)
  },
})

// Placeholder for HMAC - will be filled by hmac module
let HMAC: BaseType

export function setHMAC(hmac: BaseType) {
  HMAC = hmac
}

// CryptoJS namespace
const CryptoJS = {
  lib: {
    Base,
    WordArray,
    BufferedBlockAlgorithm,
    Hasher,
  },
  enc: {
    Hex,
    Latin1,
    Utf8,
    Base64: null as Encoder | null,
  },
  algo: {} as Record<string, BaseType>,
  mode: {} as Record<string, BaseType>,
  pad: {} as Record<string, object>,
  format: {} as Record<string, object>,
  kdf: {} as Record<string, object>,
} as const

export default CryptoJS
export { Base, WordArray, BufferedBlockAlgorithm, Hasher, Hex, Latin1, Utf8 }
export type { WordArrayInstance, Encoder, BaseType }
