import {
  aesDecrypt,
  aesEncrypt,
  sha256,
  sha256Base64,
  sha256Base64Url,
  toBase64,
  toBase64Url,
} from './crypto.ts'

describe('crypto utilities', () => {
  const testPlaintext = 'Hello, World! This is test data for encryption.'
  const testPassword = 'testPassword123'

  describe('aesEncrypt/aesDecrypt', () => {
    it('should encrypt and decrypt correctly', () => {
      const encrypted = aesEncrypt(testPlaintext, testPassword)
      const decrypted = aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(testPlaintext)
    })

    it('should produce different ciphertext each time (random salt)', () => {
      const encrypted1 = aesEncrypt(testPlaintext, testPassword)
      const encrypted2 = aesEncrypt(testPlaintext, testPassword)
      expect(encrypted1).not.toBe(encrypted2)
    })

    // it('should fail to decrypt with wrong password', () => {
    //   const encrypted = aesEncrypt(testPlaintext, testPassword)
    //   expect(() => aesDecrypt(encrypted, 'wrongPassword')).toThrow()
    // })

    it('should handle empty string', () => {
      const encrypted = aesEncrypt('', testPassword)
      const decrypted = aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe('')
    })

    it('should handle unicode characters', () => {
      const unicodeText = '你好世界 🌍 مرحبا العالم'
      const encrypted = aesEncrypt(unicodeText, testPassword)
      const decrypted = aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(unicodeText)
    })

    it('should handle large data', () => {
      const largeText = 'x'.repeat(100000)
      const encrypted = aesEncrypt(largeText, testPassword)
      const decrypted = aesDecrypt(encrypted, testPassword)
      expect(decrypted).toBe(largeText)
    })
  })

  describe('sha256', () => {
    it('should produce correct hash for known input', () => {
      const hash = sha256('test')
      const base64 = toBase64(hash)
      expect(base64).toBe('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
    })

    it('should produce correct hash for empty string', () => {
      const hash = sha256('')
      const base64 = toBase64(hash)
      expect(base64).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
    })

    it('should produce 32-byte output', () => {
      const hash = sha256('any input')
      expect(hash.length).toBe(32)
    })
  })

  describe('toBase64Url', () => {
    it('should produce URL-safe base64', () => {
      const hash = sha256('test')
      const urlSafe = toBase64Url(hash)
      expect(urlSafe).not.toContain('+')
      expect(urlSafe).not.toContain('/')
      expect(urlSafe).not.toContain('=')
    })
  })

  describe('sha256Base64 and sha256Base64Url', () => {
    it('sha256Base64 should return base64 encoded hash', () => {
      const result = sha256Base64('test')
      expect(result).toBe('n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=')
    })

    it('sha256Base64Url should return URL-safe base64 encoded hash', () => {
      const result = sha256Base64Url('test')
      expect(result).toBe('n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg')
    })
  })
})
