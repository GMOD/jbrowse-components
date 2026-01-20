// Crypto utilities using vendored crypto-js library

import CryptoJS from './crypto-js/index.ts'

/**
 * AES encrypt with crypto-js OpenSSL format
 */
export function aesEncrypt(plaintext: string, password: string): string {
  return CryptoJS.AES.encrypt(plaintext, password).toString()
}

/**
 * AES decrypt with crypto-js OpenSSL format
 */
export function aesDecrypt(ciphertext: string, password: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, password)
  return bytes.toString(CryptoJS.enc.Utf8)
}

/**
 * SHA256 hash returning Uint8Array
 */
export function sha256(data: string): Uint8Array {
  const hash = CryptoJS.SHA256(data)
  const words = hash.words
  const sigBytes = hash.sigBytes
  const result = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++) {
    result[i] = (words[i >>> 2]! >>> (24 - (i % 4) * 8)) & 0xff
  }
  return result
}

/**
 * Base64 encode a Uint8Array
 */
export function toBase64(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

/**
 * URL-safe Base64 encode (for OAuth PKCE)
 */
export function toBase64Url(data: Uint8Array): string {
  return toBase64(data)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/**
 * SHA256 hash and return as Base64
 */
export function sha256Base64(data: string): string {
  const hash = sha256(data)
  return toBase64(hash)
}

/**
 * SHA256 hash and return as URL-safe Base64 (for OAuth PKCE code challenge)
 */
export function sha256Base64Url(data: string): string {
  const hash = sha256(data)
  return toBase64Url(hash)
}
