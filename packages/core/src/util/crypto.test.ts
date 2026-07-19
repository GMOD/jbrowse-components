import { webcrypto } from 'node:crypto'

import {
  aesDecrypt,
  aesEncrypt,
  sha256,
  sha256Base64,
  sha256Base64Url,
  toBase64,
  toBase64Url,
} from './crypto.ts'

// isWebCryptoAvailable() reads crypto.subtle at call time, so both code paths
// can be exercised by swapping globalThis.crypto around a call — no module
// reload needed. jsdom's crypto has no subtle, so `secureCrypto` borrows Node's
// webcrypto to stand in for a secure browser context and `fallbackCrypto` blanks
// subtle for a non-secure one. This matters for cross-context session sharing: a
// short-link session encrypted in one context (e.g. desktop with the pure-JS
// fallback) must decrypt in another (web via crypto.subtle) and stay
// crypto-js/OpenSSL wire-compatible.
const jsdomCrypto = globalThis.crypto

function setCrypto(value: Crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    writable: true,
    configurable: true,
  })
}

const secureCrypto = webcrypto as unknown as Crypto

const fallbackCrypto = {
  getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  subtle: undefined,
  randomUUID: webcrypto.randomUUID.bind(webcrypto),
} as unknown as Crypto

afterEach(() => {
  setCrypto(jsdomCrypto)
})

describe('crypto utilities (web crypto path)', () => {
  const testPlaintext = 'Hello, World! This is test data for encryption.'
  const testPassword = 'testPassword123'

  beforeEach(() => {
    setCrypto(secureCrypto)
  })

  describe('aesEncrypt/aesDecrypt', () => {
    it('encrypts and decrypts correctly', async () => {
      const encrypted = await aesEncrypt(testPlaintext, testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(testPlaintext)
    })

    it('produces different ciphertext each time (random salt)', async () => {
      const encrypted1 = await aesEncrypt(testPlaintext, testPassword)
      const encrypted2 = await aesEncrypt(testPlaintext, testPassword)
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('uses the OpenSSL Salted__ envelope', async () => {
      const encrypted = await aesEncrypt(testPlaintext, testPassword)
      // base64 of "Salted__" is "U2FsdGVkX1"
      expect(encrypted.startsWith('U2FsdGVkX1')).toBe(true)
    })

    it('fails to decrypt with wrong password', async () => {
      const encrypted = await aesEncrypt(testPlaintext, testPassword)
      await expect(aesDecrypt(encrypted, 'wrongPassword')).rejects.toThrow()
    })

    it('handles empty string', async () => {
      const encrypted = await aesEncrypt('', testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe('')
    })

    it('handles unicode characters', async () => {
      const unicodeText = '你好世界 🌍 مرحبا العالم'
      const encrypted = await aesEncrypt(unicodeText, testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(unicodeText)
    })

    it('handles large data', async () => {
      const largeText = 'x'.repeat(100000)
      const encrypted = await aesEncrypt(largeText, testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(largeText)
    })
  })

  describe('sha256', () => {
    it('produces correct hash for known input', async () => {
      const hash = await sha256('test')
      expect(toBase64(hash)).toBe(
        'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=',
      )
    })

    it('produces correct hash for empty string', async () => {
      const hash = await sha256('')
      expect(toBase64(hash)).toBe(
        '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
      )
    })

    it('produces 32-byte output', async () => {
      const hash = await sha256('any input')
      expect(hash.length).toBe(32)
    })
  })

  describe('toBase64Url', () => {
    it('produces URL-safe base64', async () => {
      const urlSafe = toBase64Url(await sha256('test'))
      expect(urlSafe).not.toContain('+')
      expect(urlSafe).not.toContain('/')
      expect(urlSafe).not.toContain('=')
    })
  })

  describe('sha256Base64 and sha256Base64Url', () => {
    it('sha256Base64 returns base64-encoded hash', async () => {
      expect(await sha256Base64('test')).toBe(
        'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=',
      )
    })

    it('sha256Base64Url returns URL-safe base64-encoded hash', async () => {
      expect(await sha256Base64Url('test')).toBe(
        'n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg',
      )
    })
  })
})

describe('crypto fallback (non-secure context)', () => {
  const testPlaintext = 'Fallback equivalence testing 你好 🌍.'
  const testPassword = 'testPassword123'

  it('detects a non-secure context', () => {
    setCrypto(fallbackCrypto)
    expect(globalThis.crypto.subtle).toBeUndefined()
  })

  it('encrypts and decrypts correctly', async () => {
    setCrypto(fallbackCrypto)
    const encrypted = await aesEncrypt(testPlaintext, testPassword)
    const decrypted = await aesDecrypt(encrypted, testPassword)
    expect(decrypted).toBe(testPlaintext)
  })

  it('produces correct sha256 for known input', async () => {
    setCrypto(fallbackCrypto)
    expect(toBase64(await sha256('test'))).toBe(
      'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=',
    )
  })

  it('sha256 matches across many inputs', async () => {
    const inputs = [
      '',
      'a',
      'abc',
      'message digest',
      'abcdefghijklmnopqrstuvwxyz',
      '你好世界',
      'a'.repeat(1000),
    ]
    for (const input of inputs) {
      setCrypto(secureCrypto)
      const web = toBase64(await sha256(input))
      setCrypto(fallbackCrypto)
      const fallback = toBase64(await sha256(input))
      expect(fallback).toBe(web)
    }
  })
})

// The reason the fallback exists: a session encrypted where crypto.subtle is
// absent (desktop non-secure context) must decrypt where it's present (web), and
// vice versa. This is the actual web<->desktop share guarantee.
describe('crypto cross-context', () => {
  const testPlaintext = 'Cross-context session payload 🌍.'
  const testPassword = 'testPassword123'

  it('web crypto decrypts fallback-encrypted data', async () => {
    setCrypto(fallbackCrypto)
    const encrypted = await aesEncrypt(testPlaintext, testPassword)
    setCrypto(secureCrypto)
    expect(await aesDecrypt(encrypted, testPassword)).toBe(testPlaintext)
  })

  it('fallback decrypts web-crypto-encrypted data', async () => {
    setCrypto(secureCrypto)
    const encrypted = await aesEncrypt(testPlaintext, testPassword)
    setCrypto(fallbackCrypto)
    expect(await aesDecrypt(encrypted, testPassword)).toBe(testPlaintext)
  })
})
