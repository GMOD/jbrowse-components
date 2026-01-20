//@ts-nocheck
// CryptoJS EvpKDF - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

import CryptoJS, {
  Base,
  WordArray,
  type BaseType,
  type WordArrayInstance,
} from './core.ts'
import { MD5 } from './md5.ts'

const EvpKDF = Base.extend({
  cfg: Base.extend({
    keySize: 128 / 32,
    hasher: MD5,
    iterations: 1,
  }),

  init(cfg?: object) {
    // @ts-expect-error
    this.cfg = this.cfg.extend(cfg)
  },

  compute(
    password: WordArrayInstance | string,
    salt: WordArrayInstance | string,
  ) {
    let block
    // @ts-expect-error
    const cfg = this.cfg
    // @ts-expect-error
    const hasher = cfg.hasher.create()
    // @ts-expect-error
    const derivedKey = WordArray.create()
    const derivedKeyWords = derivedKey.words
    const keySize = cfg.keySize
    const iterations = cfg.iterations

    while (derivedKeyWords.length < keySize) {
      if (block) {
        hasher.update(block)
      }
      block = hasher.update(password).finalize(salt)
      hasher.reset()

      for (let i = 1; i < iterations; i++) {
        block = hasher.finalize(block)
        hasher.reset()
      }

      derivedKey.concat(block)
    }
    derivedKey.sigBytes = keySize * 4

    return derivedKey
  },
})

function EvpKDFFunc(
  password: WordArrayInstance | string,
  salt: WordArrayInstance | string,
  cfg?: object,
) {
  // @ts-expect-error
  return EvpKDF.create(cfg).compute(password, salt)
}

CryptoJS.algo.EvpKDF = EvpKDF
// @ts-expect-error
CryptoJS.EvpKDF = EvpKDFFunc

export default EvpKDF
export { EvpKDF, EvpKDFFunc }
