import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import {
  aesEncrypt,
  aesDecrypt,
  sha256,
  toBase64,
  toBase64Url,
  sha256Base64,
  sha256Base64Url,
} from './crypto.ts'

describe('crypto utilities', () => {
  const testPlaintext = 'Hello, World! This is test data for encryption.'
  const testPassword = 'testPassword123'

  describe('aesEncrypt/aesDecrypt with Web Crypto', () => {
    it('should encrypt and decrypt correctly', async () => {
      const encrypted = await aesEncrypt(testPlaintext, testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(testPlaintext)
    })

    it('should produce different ciphertext each time (random salt)', async () => {
      const encrypted1 = await aesEncrypt(testPlaintext, testPassword)
      const encrypted2 = await aesEncrypt(testPlaintext, testPassword)
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should fail to decrypt with wrong password', async () => {
      const encrypted = await aesEncrypt(testPlaintext, testPassword)
      await expect(aesDecrypt(encrypted, 'wrongPassword')).rejects.toThrow()
    })

    it('should handle empty string', async () => {
      const encrypted = await aesEncrypt('', testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe('')
    })

    it('should handle unicode characters', async () => {
      const unicodeText = '你好世界 🌍 مرحبا العالم'
      const encrypted = await aesEncrypt(unicodeText, testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(unicodeText)
    })

    it('should handle large data', async () => {
      const largeText = 'x'.repeat(100000)
      const encrypted = await aesEncrypt(largeText, testPassword)
      const decrypted = await aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(largeText)
    })
  })

  describe('sha256', () => {
    it('should produce correct hash for known input', async () => {
      const hash = await sha256('test')
      const base64 = toBase64(hash)
      expect(base64).toBe('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
    })

    it('should produce correct hash for empty string', async () => {
      const hash = await sha256('')
      const base64 = toBase64(hash)
      expect(base64).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
    })

    it('should produce 32-byte output', async () => {
      const hash = await sha256('any input')
      expect(hash.length).toBe(32)
    })
  })

  describe('toBase64Url', () => {
    it('should produce URL-safe base64', async () => {
      const hash = await sha256('test')
      const urlSafe = toBase64Url(hash)
      expect(urlSafe).not.toContain('+')
      expect(urlSafe).not.toContain('/')
      expect(urlSafe).not.toContain('=')
    })
  })

  describe('sha256Base64 and sha256Base64Url', () => {
    it('sha256Base64 should return base64 encoded hash', async () => {
      const result = await sha256Base64('test')
      expect(result).toBe('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
    })

    it('sha256Base64Url should return URL-safe base64 encoded hash', async () => {
      const result = await sha256Base64Url('test')
      expect(result).toBe('n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg')
    })
  })
})

describe('crypto fallback equivalence', () => {
  const testPlaintext =
    'Hello, World! This is test data for fallback equivalence testing.'
  const testPassword = 'testPassword123'

  let originalCrypto: Crypto
  let webCryptoEncrypted: string

  beforeAll(async () => {
    originalCrypto = globalThis.crypto
    // Encrypt with Web Crypto before mocking
    webCryptoEncrypted = await aesEncrypt(testPlaintext, testPassword)
  })

  afterAll(() => {
    // Restore original crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    })
  })

  describe('fallback mode', () => {
    let fallbackModule: typeof import('./crypto.ts')

    beforeAll(async () => {
      // Mock crypto to simulate non-secure context
      const mockCrypto = {
        getRandomValues: (arr: Uint8Array) =>
          originalCrypto.getRandomValues(arr),
        subtle: undefined,
        randomUUID: () => originalCrypto.randomUUID(),
      }
      Object.defineProperty(globalThis, 'crypto', {
        value: mockCrypto,
        writable: true,
        configurable: true,
      })

      // Dynamically import to get module with mocked crypto
      const timestamp = Date.now()
      fallbackModule = await import(`./crypto.ts?t=${timestamp}`)
    })

    it('should detect non-secure context', () => {
      expect(globalThis.crypto.subtle).toBeUndefined()
    })

    it('fallback should encrypt and decrypt correctly', async () => {
      const encrypted = await fallbackModule.aesEncrypt(
        testPlaintext,
        testPassword,
      )
      const decrypted = await fallbackModule.aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(testPlaintext)
    })

    it('fallback should decrypt Web Crypto encrypted data', async () => {
      const decrypted = await fallbackModule.aesDecrypt(
        webCryptoEncrypted,
        testPassword,
      )
      expect(decrypted).toBe(testPlaintext)
    })

    it('fallback should handle unicode characters', async () => {
      const unicodeText = '你好世界 🌍 مرحبا العالم'
      const encrypted = await fallbackModule.aesEncrypt(
        unicodeText,
        testPassword,
      )
      const decrypted = await fallbackModule.aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(unicodeText)
    })

    it('fallback sha256 should produce correct hash', async () => {
      const hash = await fallbackModule.sha256('test')
      const base64 = fallbackModule.toBase64(hash)
      expect(base64).toBe('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
    })

    it('fallback sha256 should match Web Crypto sha256 for various inputs', async () => {
      // Restore Web Crypto temporarily for comparison
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      })
      const webCryptoModule = await import(`./crypto.ts?t=${Date.now() + 1}`)

      const testInputs = [
        '',
        'a',
        'abc',
        'message digest',
        'abcdefghijklmnopqrstuvwxyz',
        '你好世界',
        'a'.repeat(1000),
      ]

      for (const input of testInputs) {
        const webCryptoHash = await webCryptoModule.sha256(input)
        const fallbackHash = await fallbackModule.sha256(input)
        expect(fallbackModule.toBase64(fallbackHash)).toBe(
          webCryptoModule.toBase64(webCryptoHash),
        )
      }

      // Restore mock for subsequent tests
      const mockCrypto = {
        getRandomValues: (arr: Uint8Array) =>
          originalCrypto.getRandomValues(arr),
        subtle: undefined,
        randomUUID: () => originalCrypto.randomUUID(),
      }
      Object.defineProperty(globalThis, 'crypto', {
        value: mockCrypto,
        writable: true,
        configurable: true,
      })
    })
  })

  describe('cross-mode compatibility', () => {
    it('Web Crypto should decrypt fallback encrypted data', async () => {
      // First encrypt with fallback (crypto.subtle is still mocked from previous tests)
      const mockCrypto = {
        getRandomValues: (arr: Uint8Array) =>
          originalCrypto.getRandomValues(arr),
        subtle: undefined,
        randomUUID: () => originalCrypto.randomUUID(),
      }
      Object.defineProperty(globalThis, 'crypto', {
        value: mockCrypto,
        writable: true,
        configurable: true,
      })

      const fallbackModule = await import(`./crypto.ts?t=${Date.now() + 100}`)
      const fallbackEncrypted = await fallbackModule.aesEncrypt(
        testPlaintext,
        testPassword,
      )

      // Then restore Web Crypto and decrypt
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      })

      const webCryptoModule = await import(`./crypto.ts?t=${Date.now() + 200}`)
      const decrypted = await webCryptoModule.aesDecrypt(
        fallbackEncrypted,
        testPassword,
      )

      expect(decrypted).toBe(testPlaintext)
    })
  })
})
