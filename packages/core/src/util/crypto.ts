// SHA-256 and Base64 through Web Crypto where available, pure JS in non-secure
// contexts. AES lives in `aes.ts`.

// Check if Web Crypto API is available (only in secure contexts)
export function isWebCryptoAvailable() {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return typeof crypto !== 'undefined' && crypto.subtle !== undefined
}

// SHA256 constants
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

// SHA256 pure JS implementation
function sha256Fallback(data: Uint8Array) {
  function rotr(x: number, n: number) {
    return (x >>> n) | (x << (32 - n))
  }

  function ch(x: number, y: number, z: number) {
    return (x & y) ^ (~x & z)
  }

  function maj(x: number, y: number, z: number) {
    return (x & y) ^ (x & z) ^ (y & z)
  }

  function sigma0(x: number) {
    return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)
  }

  function sigma1(x: number) {
    return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)
  }

  function gamma0(x: number) {
    return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)
  }

  function gamma1(x: number) {
    return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)
  }

  // Pre-processing
  const originalLength = data.length
  const bitLength = originalLength * 8

  // Padding: append 1 bit, then zeros, then 64-bit length (big-endian)
  const paddingLength = (64 - ((originalLength + 9) % 64)) % 64
  const padded = new Uint8Array(originalLength + 1 + paddingLength + 8)
  padded.set(data)
  padded[originalLength] = 0x80

  // Append length as big-endian 64-bit
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, bitLength >>> 0, false)
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000), false)

  // Initialize hash values
  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  // Process each 512-bit chunk
  const W = new Uint32Array(64)
  for (let i = 0; i < padded.length; i += 64) {
    // Prepare message schedule
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false)
    }
    for (let t = 16; t < 64; t++) {
      W[t] =
        (gamma1(W[t - 2]!) + W[t - 7]! + gamma0(W[t - 15]!) + W[t - 16]!) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let t = 0; t < 64; t++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + SHA256_K[t]! + W[t]!) >>> 0
      const T2 = (sigma0(a) + maj(a, b, c)) >>> 0
      h = g
      g = f
      f = e
      e = (d + T1) >>> 0
      d = c
      c = b
      b = a
      a = (T1 + T2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  const result = new Uint8Array(32)
  const resultView = new DataView(result.buffer)
  resultView.setUint32(0, h0, false)
  resultView.setUint32(4, h1, false)
  resultView.setUint32(8, h2, false)
  resultView.setUint32(12, h3, false)
  resultView.setUint32(16, h4, false)
  resultView.setUint32(20, h5, false)
  resultView.setUint32(24, h6, false)
  resultView.setUint32(28, h7, false)

  return result
}

// Convert string to Uint8Array (UTF-8)
export function stringToBytes(str: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(str)
  // Return a copy with a fresh ArrayBuffer to satisfy TypeScript's strict typing
  return encoded.slice()
}

// Convert Uint8Array to string (UTF-8)
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

// Base64 encode
export function base64Encode(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// Base64 decode
export function base64Decode(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * SHA256 hash
 * Uses Web Crypto API when available, falls back to pure JS in non-secure contexts
 */
export async function sha256(data: string): Promise<Uint8Array> {
  const encoded = stringToBytes(data)
  if (isWebCryptoAvailable()) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    return new Uint8Array(hashBuffer)
  }
  return sha256Fallback(encoded)
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
