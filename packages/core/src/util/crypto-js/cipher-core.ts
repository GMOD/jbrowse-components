//@ts-nocheck
// CryptoJS Cipher Core - converted to ESM
// Original source: https://github.com/brix/crypto-js
// License: MIT

import CryptoJS, {
  Base,
  WordArray,
  BufferedBlockAlgorithm,
  Utf8,
  type BaseType,
  type WordArrayInstance,
} from './core.ts'
import { Base64 } from './enc-base64.ts'
import { EvpKDF } from './evpkdf.ts'

const Cipher = BufferedBlockAlgorithm.extend({
  cfg: Base.extend(),

  createEncryptor(key: WordArrayInstance, cfg?: object) {
    // @ts-expect-error
    return this.create(this._ENC_XFORM_MODE, key, cfg)
  },

  createDecryptor(key: WordArrayInstance, cfg?: object) {
    // @ts-expect-error
    return this.create(this._DEC_XFORM_MODE, key, cfg)
  },

  init(xformMode: number, key: WordArrayInstance, cfg?: object) {
    // @ts-expect-error
    this.cfg = this.cfg.extend(cfg)
    // @ts-expect-error
    this._xformMode = xformMode
    // @ts-expect-error
    this._key = key
    this.reset()
  },

  reset() {
    BufferedBlockAlgorithm.reset.call(this)
    // @ts-expect-error
    this._doReset()
  },

  process(dataUpdate: WordArrayInstance | string) {
    // @ts-expect-error
    this._append(dataUpdate)
    // @ts-expect-error
    return this._process()
  },

  finalize(dataUpdate?: WordArrayInstance | string) {
    if (dataUpdate) {
      // @ts-expect-error
      this._append(dataUpdate)
    }
    // @ts-expect-error
    return this._doFinalize()
  },

  keySize: 128 / 32,
  ivSize: 128 / 32,
  _ENC_XFORM_MODE: 1,
  _DEC_XFORM_MODE: 2,

  _createHelper: (() => {
    function selectCipherStrategy(key: unknown) {
      if (typeof key === 'string') {
        return PasswordBasedCipher
      }
      return SerializableCipher
    }

    return (cipher: BaseType) => ({
      encrypt(
        message: WordArrayInstance | string,
        key: WordArrayInstance | string,
        cfg?: object,
      ) {
        return selectCipherStrategy(key).encrypt(cipher, message, key, cfg)
      },
      decrypt(
        ciphertext: string | CipherParamsInstance,
        key: WordArrayInstance | string,
        cfg?: object,
      ) {
        return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg)
      },
    })
  })(),
})

const BlockCipherMode = Base.extend({
  createEncryptor(cipher: BaseType, iv: number[]) {
    // @ts-expect-error
    return this.Encryptor.create(cipher, iv)
  },

  createDecryptor(cipher: BaseType, iv: number[]) {
    // @ts-expect-error
    return this.Decryptor.create(cipher, iv)
  },

  init(cipher: BaseType, iv: number[]) {
    // @ts-expect-error
    this._cipher = cipher
    // @ts-expect-error
    this._iv = iv
  },
})

function xorBlock(
  this: { _iv?: number[]; _prevBlock?: number[] },
  words: number[],
  offset: number,
  blockSize: number,
) {
  let block
  const iv = this._iv

  if (iv) {
    block = iv
    this._iv = undefined
  } else {
    block = this._prevBlock
  }

  for (let i = 0; i < blockSize; i++) {
    words[offset + i] ^= block![i]!
  }
}

const CBC = (() => {
  const CBC = BlockCipherMode.extend()

  // @ts-expect-error
  CBC.Encryptor = CBC.extend({
    processBlock(words: number[], offset: number) {
      // @ts-expect-error
      const cipher = this._cipher
      const blockSize = cipher.blockSize

      xorBlock.call(this, words, offset, blockSize)
      cipher.encryptBlock(words, offset)

      this._prevBlock = words.slice(offset, offset + blockSize)
    },
  })

  // @ts-expect-error
  CBC.Decryptor = CBC.extend({
    processBlock(words: number[], offset: number) {
      // @ts-expect-error
      const cipher = this._cipher
      const blockSize = cipher.blockSize

      const thisBlock = words.slice(offset, offset + blockSize)

      cipher.decryptBlock(words, offset)
      xorBlock.call(this, words, offset, blockSize)

      this._prevBlock = thisBlock
    },
  })

  return CBC
})()

const Pkcs7 = {
  pad(data: WordArrayInstance, blockSize: number) {
    const blockSizeBytes = blockSize * 4
    const nPaddingBytes = blockSizeBytes - (data.sigBytes % blockSizeBytes)
    const paddingWord =
      (nPaddingBytes << 24) |
      (nPaddingBytes << 16) |
      (nPaddingBytes << 8) |
      nPaddingBytes

    const paddingWords: number[] = []
    for (let i = 0; i < nPaddingBytes; i += 4) {
      paddingWords.push(paddingWord)
    }
    // @ts-expect-error
    const padding = WordArray.create(paddingWords, nPaddingBytes)

    data.concat(padding)
  },

  unpad(data: WordArrayInstance) {
    const nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2]! & 0xff
    data.sigBytes -= nPaddingBytes
  },
}

const BlockCipher = Cipher.extend({
  cfg: Cipher.cfg.extend({
    mode: CBC,
    padding: Pkcs7,
  }),

  reset() {
    let modeCreator
    Cipher.reset.call(this)
    // @ts-expect-error
    const cfg = this.cfg
    const iv = cfg.iv
    const mode = cfg.mode

    // @ts-expect-error
    if (this._xformMode === this._ENC_XFORM_MODE) {
      modeCreator = mode.createEncryptor
    } else {
      modeCreator = mode.createDecryptor
      // @ts-expect-error
      this._minBufferSize = 1
    }

    // @ts-expect-error
    if (this._mode && this._mode.__creator === modeCreator) {
      // @ts-expect-error
      this._mode.init(this, iv && iv.words)
    } else {
      // @ts-expect-error
      this._mode = modeCreator.call(mode, this, iv && iv.words)
      // @ts-expect-error
      this._mode.__creator = modeCreator
    }
  },

  _doProcessBlock(words: number[], offset: number) {
    // @ts-expect-error
    this._mode.processBlock(words, offset)
  },

  _doFinalize() {
    let finalProcessedBlocks
    // @ts-expect-error
    const padding = this.cfg.padding

    // @ts-expect-error
    if (this._xformMode === this._ENC_XFORM_MODE) {
      // @ts-expect-error
      padding.pad(this._data, this.blockSize)
      // @ts-expect-error
      finalProcessedBlocks = this._process(!!'flush')
    } else {
      // @ts-expect-error
      finalProcessedBlocks = this._process(!!'flush')
      padding.unpad(finalProcessedBlocks)
    }

    return finalProcessedBlocks
  },

  blockSize: 128 / 32,
})

interface CipherParamsInstance extends BaseType {
  ciphertext?: WordArrayInstance
  key?: WordArrayInstance
  iv?: WordArrayInstance
  salt?: WordArrayInstance
  algorithm?: BaseType
  mode?: BaseType
  padding?: object
  blockSize?: number
  formatter?: OpenSSLFormatterType
}

const CipherParams = Base.extend({
  init(cipherParams: object) {
    this.mixIn(cipherParams)
  },

  toString(formatter?: OpenSSLFormatterType) {
    // @ts-expect-error
    return (formatter || this.formatter).stringify(this)
  },
})

interface OpenSSLFormatterType {
  stringify: (cipherParams: CipherParamsInstance) => string
  parse: (openSSLStr: string) => CipherParamsInstance
}

const OpenSSLFormatter: OpenSSLFormatterType = {
  stringify(cipherParams) {
    let wordArray
    const ciphertext = cipherParams.ciphertext
    const salt = cipherParams.salt

    if (salt) {
      // @ts-expect-error
      wordArray = WordArray.create([0x53616c74, 0x65645f5f])
        .concat(salt)
        .concat(ciphertext)
    } else {
      wordArray = ciphertext
    }

    return wordArray!.toString(Base64)
  },

  parse(openSSLStr) {
    let salt
    const ciphertext = Base64.parse(openSSLStr)
    const ciphertextWords = ciphertext.words

    if (
      ciphertextWords[0] === 0x53616c74 &&
      ciphertextWords[1] === 0x65645f5f
    ) {
      // @ts-expect-error
      salt = WordArray.create(ciphertextWords.slice(2, 4))
      ciphertextWords.splice(0, 4)
      ciphertext.sigBytes -= 16
    }

    // @ts-expect-error
    return CipherParams.create({ ciphertext, salt })
  },
}

const SerializableCipher = Base.extend({
  cfg: Base.extend({
    format: OpenSSLFormatter,
  }),

  encrypt(
    cipher: BaseType,
    message: WordArrayInstance | string,
    key: WordArrayInstance,
    cfg?: object,
  ) {
    // @ts-expect-error
    cfg = this.cfg.extend(cfg)
    // @ts-expect-error
    const encryptor = cipher.createEncryptor(key, cfg)
    const ciphertext = encryptor.finalize(message)
    const cipherCfg = encryptor.cfg

    // @ts-expect-error
    return CipherParams.create({
      ciphertext,
      key,
      iv: cipherCfg.iv,
      algorithm: cipher,
      mode: cipherCfg.mode,
      padding: cipherCfg.padding,
      blockSize: cipher.blockSize,
      // @ts-expect-error
      formatter: cfg.format,
    })
  },

  decrypt(
    cipher: BaseType,
    ciphertext: string | CipherParamsInstance,
    key: WordArrayInstance,
    cfg?: object,
  ) {
    // @ts-expect-error
    cfg = this.cfg.extend(cfg)
    // @ts-expect-error
    ciphertext = this._parse(ciphertext, cfg.format)
    // @ts-expect-error
    return cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext)
  },

  _parse(
    ciphertext: string | CipherParamsInstance,
    format: OpenSSLFormatterType,
  ) {
    if (typeof ciphertext === 'string') {
      return format.parse(ciphertext)
    }
    return ciphertext
  },
})

const OpenSSLKdf = {
  execute(
    password: string,
    keySize: number,
    ivSize: number,
    salt?: WordArrayInstance,
  ) {
    if (!salt) {
      // @ts-expect-error
      salt = WordArray.random(64 / 8)
    }

    // @ts-expect-error
    const key = EvpKDF.create({ keySize: keySize + ivSize }).compute(
      password,
      salt,
    )

    // @ts-expect-error
    const iv = WordArray.create(key.words.slice(keySize), ivSize * 4)
    key.sigBytes = keySize * 4

    // @ts-expect-error
    return CipherParams.create({ key, iv, salt })
  },
}

const PasswordBasedCipher = SerializableCipher.extend({
  cfg: SerializableCipher.cfg.extend({
    kdf: OpenSSLKdf,
  }),

  encrypt(
    cipher: BaseType,
    message: WordArrayInstance | string,
    password: string,
    cfg?: object,
  ) {
    // @ts-expect-error
    cfg = this.cfg.extend(cfg)
    // @ts-expect-error
    const derivedParams = cfg.kdf.execute(
      password,
      // @ts-expect-error
      cipher.keySize,
      // @ts-expect-error
      cipher.ivSize,
      // @ts-expect-error
      cfg.salt,
    )
    // @ts-expect-error
    cfg.iv = derivedParams.iv

    const ciphertext = SerializableCipher.encrypt.call(
      this,
      cipher,
      message,
      derivedParams.key,
      cfg,
    )
    ciphertext.mixIn(derivedParams)

    return ciphertext
  },

  decrypt(
    cipher: BaseType,
    ciphertext: string | CipherParamsInstance,
    password: string,
    cfg?: object,
  ) {
    // @ts-expect-error
    cfg = this.cfg.extend(cfg)
    // @ts-expect-error
    ciphertext = this._parse(ciphertext, cfg.format)
    // @ts-expect-error
    const derivedParams = cfg.kdf.execute(
      password,
      // @ts-expect-error
      cipher.keySize,
      // @ts-expect-error
      cipher.ivSize,
      // @ts-expect-error
      ciphertext.salt,
    )
    // @ts-expect-error
    cfg.iv = derivedParams.iv

    return SerializableCipher.decrypt.call(
      this,
      cipher,
      ciphertext,
      derivedParams.key,
      cfg,
    )
  },
})

// Add to CryptoJS
CryptoJS.lib.Cipher = Cipher
CryptoJS.lib.BlockCipher = BlockCipher
CryptoJS.lib.CipherParams = CipherParams
CryptoJS.lib.SerializableCipher = SerializableCipher
CryptoJS.lib.PasswordBasedCipher = PasswordBasedCipher
CryptoJS.mode.CBC = CBC
CryptoJS.pad.Pkcs7 = Pkcs7
CryptoJS.format.OpenSSL = OpenSSLFormatter
CryptoJS.kdf.OpenSSL = OpenSSLKdf

export {
  Cipher,
  BlockCipher,
  BlockCipherMode,
  CipherParams,
  SerializableCipher,
  PasswordBasedCipher,
  CBC,
  Pkcs7,
  OpenSSLFormatter,
  OpenSSLKdf,
}
export type { CipherParamsInstance }
