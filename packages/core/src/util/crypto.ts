// Crypto utilities using Web Crypto API
// Compatible with crypto-js OpenSSL format for AES encryption

const SALT_PREFIX = 'Salted__'

// MD5 implementation for EVP_BytesToKey (required for crypto-js compatibility)
function md5(data: Uint8Array): Uint8Array {
  // MD5 constants
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ]
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]

  function leftRotate(x: number, c: number) {
    return (x << c) | (x >>> (32 - c))
  }

  // Pre-processing: adding padding bits
  const originalLength = data.length
  const bitLength = originalLength * 8

  // Append "1" bit and padding zeros
  const paddingLength = (56 - ((originalLength + 1) % 64) + 64) % 64
  const padded = new Uint8Array(originalLength + 1 + paddingLength + 8)
  padded.set(data)
  padded[originalLength] = 0x80

  // Append original length in bits as 64-bit little-endian
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, bitLength >>> 0, true)
  view.setUint32(padded.length - 4, Math.floor(bitLength / 0x100000000), true)

  // Initialize hash values
  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  // Process each 512-bit chunk
  for (let i = 0; i < padded.length; i += 64) {
    const M = new Uint32Array(16)
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(i + j * 4, true)
    }

    let A = a0
    let B = b0
    let C = c0
    let D = d0

    for (let j = 0; j < 64; j++) {
      let F: number
      let g: number

      if (j < 16) {
        F = (B & C) | (~B & D)
        g = j
      } else if (j < 32) {
        F = (D & B) | (~D & C)
        g = (5 * j + 1) % 16
      } else if (j < 48) {
        F = B ^ C ^ D
        g = (3 * j + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * j) % 16
      }

      F = (F + A + K[j]! + M[g]!) >>> 0
      A = D
      D = C
      C = B
      B = (B + leftRotate(F, S[j]!)) >>> 0
    }

    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const result = new Uint8Array(16)
  const resultView = new DataView(result.buffer)
  resultView.setUint32(0, a0, true)
  resultView.setUint32(4, b0, true)
  resultView.setUint32(8, c0, true)
  resultView.setUint32(12, d0, true)

  return result
}

// EVP_BytesToKey - OpenSSL key derivation function used by crypto-js
function evpBytesToKey(
  password: Uint8Array,
  salt: Uint8Array,
  keyLen: number,
  ivLen: number,
): { key: Uint8Array; iv: Uint8Array } {
  const result = new Uint8Array(keyLen + ivLen)
  let offset = 0
  let prevHash = new Uint8Array(0)

  while (offset < keyLen + ivLen) {
    const data = new Uint8Array(prevHash.length + password.length + salt.length)
    data.set(prevHash)
    data.set(password, prevHash.length)
    data.set(salt, prevHash.length + password.length)
    prevHash = md5(data)
    result.set(prevHash.subarray(0, Math.min(16, keyLen + ivLen - offset)), offset)
    offset += 16
  }

  return {
    key: result.subarray(0, keyLen),
    iv: result.subarray(keyLen, keyLen + ivLen),
  }
}

// PKCS7 padding
function pkcs7Pad(data: Uint8Array, blockSize: number): Uint8Array {
  const padding = blockSize - (data.length % blockSize)
  const padded = new Uint8Array(data.length + padding)
  padded.set(data)
  padded.fill(padding, data.length)
  return padded
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  const padding = data[data.length - 1]!
  if (padding > 16 || padding === 0) {
    throw new Error('Invalid padding')
  }
  return data.subarray(0, data.length - padding)
}

// Convert string to Uint8Array (UTF-8)
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// Convert Uint8Array to string (UTF-8)
function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

// Base64 encode
function base64Encode(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// Base64 decode
function base64Decode(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * AES encrypt using Web Crypto API, compatible with crypto-js OpenSSL format
 */
export async function aesEncrypt(
  plaintext: string,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(8))
  const { key, iv } = evpBytesToKey(stringToBytes(password), salt, 32, 16)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  )

  const paddedData = pkcs7Pad(stringToBytes(plaintext), 16)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    paddedData,
  )

  // Format: "Salted__" + salt + ciphertext, then Base64
  const saltPrefix = stringToBytes(SALT_PREFIX)
  const result = new Uint8Array(
    saltPrefix.length + salt.length + encrypted.byteLength,
  )
  result.set(saltPrefix)
  result.set(salt, saltPrefix.length)
  result.set(new Uint8Array(encrypted), saltPrefix.length + salt.length)

  return base64Encode(result)
}

/**
 * AES decrypt using Web Crypto API, compatible with crypto-js OpenSSL format
 */
export async function aesDecrypt(
  ciphertext: string,
  password: string,
): Promise<string> {
  const data = base64Decode(ciphertext)

  // Check for "Salted__" prefix
  const saltPrefix = stringToBytes(SALT_PREFIX)
  const hasSalt =
    data.length > saltPrefix.length &&
    bytesToString(data.subarray(0, saltPrefix.length)) === SALT_PREFIX

  if (!hasSalt) {
    throw new Error('Invalid encrypted data format')
  }

  const salt = data.subarray(saltPrefix.length, saltPrefix.length + 8)
  const encrypted = data.subarray(saltPrefix.length + 8)

  const { key, iv } = evpBytesToKey(stringToBytes(password), salt, 32, 16)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    encrypted,
  )

  return bytesToString(pkcs7Unpad(new Uint8Array(decrypted)))
}

/**
 * SHA256 hash using Web Crypto API
 */
export async function sha256(data: string): Promise<Uint8Array> {
  const encoded = stringToBytes(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return new Uint8Array(hashBuffer)
}

/**
 * Base64 encode a Uint8Array
 */
export function toBase64(data: Uint8Array): string {
  return base64Encode(data)
}

/**
 * URL-safe Base64 encode (for OAuth PKCE)
 */
export function toBase64Url(data: Uint8Array): string {
  return base64Encode(data)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/**
 * SHA256 hash and return as Base64 (for OAuth PKCE code challenge)
 */
export async function sha256Base64(data: string): Promise<string> {
  const hash = await sha256(data)
  return toBase64(hash)
}

/**
 * SHA256 hash and return as URL-safe Base64 (for OAuth PKCE code challenge)
 */
export async function sha256Base64Url(data: string): Promise<string> {
  const hash = await sha256(data)
  return toBase64Url(hash)
}
