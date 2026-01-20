//@ts-nocheck
// CryptoJS HMAC - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

import CryptoJS, {
  Base,
  Utf8,
  setHMAC,
  type BaseType,
  type WordArrayInstance,
} from './core.ts'

const HMAC = Base.extend({
  init(hasher: BaseType, key: WordArrayInstance | string) {
    // @ts-expect-error
    hasher = this._hasher = new hasher.init()

    if (typeof key === 'string') {
      key = Utf8.parse(key)
    }

    // @ts-expect-error
    const hasherBlockSize = hasher.blockSize
    const hasherBlockSizeBytes = hasherBlockSize * 4

    if (key.sigBytes > hasherBlockSizeBytes) {
      // @ts-expect-error
      key = hasher.finalize(key)
    }

    key.clamp()

    // @ts-expect-error
    const oKey = (this._oKey = key.clone())
    // @ts-expect-error
    const iKey = (this._iKey = key.clone())

    const oKeyWords = oKey.words
    const iKeyWords = iKey.words

    for (let i = 0; i < hasherBlockSize; i++) {
      oKeyWords[i] ^= 0x5c5c5c5c
      iKeyWords[i] ^= 0x36363636
    }
    oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes

    this.reset()
  },

  reset() {
    // @ts-expect-error
    const hasher = this._hasher

    hasher.reset()
    // @ts-expect-error
    hasher.update(this._iKey)
  },

  update(messageUpdate: WordArrayInstance | string) {
    // @ts-expect-error
    this._hasher.update(messageUpdate)
    return this
  },

  finalize(messageUpdate?: WordArrayInstance | string) {
    // @ts-expect-error
    const hasher = this._hasher
    const innerHash = hasher.finalize(messageUpdate)
    hasher.reset()
    // @ts-expect-error
    return hasher.finalize(this._oKey.clone().concat(innerHash))
  },
})

// Register HMAC with core
setHMAC(HMAC)

CryptoJS.algo.HMAC = HMAC

export default HMAC
export { HMAC }
