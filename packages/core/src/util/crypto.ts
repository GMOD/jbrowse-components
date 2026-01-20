// Crypto utilities using Web Crypto API with pure JS fallback for non-secure contexts
// Compatible with crypto-js OpenSSL format for AES encryption

const SALT_PREFIX = 'Salted__'

// Check if Web Crypto API is available (only in secure contexts)
function isWebCryptoAvailable() {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return typeof crypto !== 'undefined' && crypto.subtle !== undefined
}

// AES S-box
const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe,
  0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4,
  0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7,
  0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3,
  0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09,
  0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3,
  0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe,
  0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85,
  0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92,
  0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c,
  0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19,
  0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14,
  0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2,
  0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5,
  0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25,
  0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86,
  0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e,
  0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42,
  0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
])

// AES inverse S-box
const SBOX_INV = new Uint8Array([
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81,
  0xf3, 0xd7, 0xfb, 0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e,
  0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb, 0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23,
  0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e, 0x08, 0x2e, 0xa1, 0x66,
  0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25, 0x72,
  0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65,
  0xb6, 0x92, 0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46,
  0x57, 0xa7, 0x8d, 0x9d, 0x84, 0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a,
  0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06, 0xd0, 0x2c, 0x1e, 0x8f, 0xca,
  0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b, 0x3a, 0x91,
  0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6,
  0x73, 0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8,
  0x1c, 0x75, 0xdf, 0x6e, 0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f,
  0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b, 0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2,
  0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4, 0x1f, 0xdd, 0xa8,
  0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93,
  0xc9, 0x9c, 0xef, 0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb,
  0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61, 0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6,
  0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
])

// Round constants for key expansion
const RCON = new Uint8Array([
  0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
])

// Galois field multiplication
function gmul(a: number, b: number) {
  let p = 0
  for (let i = 0; i < 8; i++) {
    if (b & 1) {
      p ^= a
    }
    const hiBit = a & 0x80
    a = (a << 1) & 0xff
    if (hiBit) {
      a ^= 0x1b
    }
    b >>= 1
  }
  return p
}

// AES key expansion for 256-bit key
function aesKeyExpansion(key: Uint8Array) {
  const Nk = 8 // 256-bit key = 8 words
  const Nr = 14 // 14 rounds for 256-bit
  const expandedKey = new Uint8Array(16 * (Nr + 1))
  expandedKey.set(key)

  for (let i = Nk; i < 4 * (Nr + 1); i++) {
    const temp = expandedKey.slice((i - 1) * 4, i * 4)
    if (i % Nk === 0) {
      // RotWord + SubWord + Rcon
      const t = temp[0]!
      temp[0] = SBOX[temp[1]!]! ^ RCON[i / Nk - 1]!
      temp[1] = SBOX[temp[2]!]!
      temp[2] = SBOX[temp[3]!]!
      temp[3] = SBOX[t]!
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (Nk > 6 && i % Nk === 4) {
      // SubWord for 256-bit keys
      for (let j = 0; j < 4; j++) {
        temp[j] = SBOX[temp[j]!]!
      }
    }
    for (let j = 0; j < 4; j++) {
      expandedKey[i * 4 + j] = expandedKey[(i - Nk) * 4 + j]! ^ temp[j]!
    }
  }
  return expandedKey
}

// AES encrypt single block (pure JS)
function aesEncryptBlock(block: Uint8Array, expandedKey: Uint8Array) {
  const Nr = 14
  const state = new Uint8Array(16)
  state.set(block)

  // AddRoundKey
  for (let i = 0; i < 16; i++) {
    state[i]! ^= expandedKey[i]!
  }

  for (let round = 1; round <= Nr; round++) {
    // SubBytes
    for (let i = 0; i < 16; i++) {
      state[i] = SBOX[state[i]!]!
    }

    // ShiftRows
    const t1 = state[1]!
    state[1] = state[5]!
    state[5] = state[9]!
    state[9] = state[13]!
    state[13] = t1

    const t2 = state[2]!
    const t6 = state[6]!
    state[2] = state[10]!
    state[6] = state[14]!
    state[10] = t2
    state[14] = t6

    const t3 = state[15]!
    state[15] = state[11]!
    state[11] = state[7]!
    state[7] = state[3]!
    state[3] = t3

    // MixColumns (skip in last round)
    if (round < Nr) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4
        const s0 = state[i]!
        const s1 = state[i + 1]!
        const s2 = state[i + 2]!
        const s3 = state[i + 3]!
        state[i] = gmul(s0, 2) ^ gmul(s1, 3) ^ s2 ^ s3
        state[i + 1] = s0 ^ gmul(s1, 2) ^ gmul(s2, 3) ^ s3
        state[i + 2] = s0 ^ s1 ^ gmul(s2, 2) ^ gmul(s3, 3)
        state[i + 3] = gmul(s0, 3) ^ s1 ^ s2 ^ gmul(s3, 2)
      }
    }

    // AddRoundKey
    const roundKey = expandedKey.subarray(round * 16, (round + 1) * 16)
    for (let i = 0; i < 16; i++) {
      state[i]! ^= roundKey[i]!
    }
  }

  return state
}

// AES decrypt single block (pure JS)
function aesDecryptBlock(block: Uint8Array, expandedKey: Uint8Array) {
  const Nr = 14
  const state = new Uint8Array(16)
  state.set(block)

  // AddRoundKey
  for (let i = 0; i < 16; i++) {
    state[i]! ^= expandedKey[Nr * 16 + i]!
  }

  for (let round = Nr - 1; round >= 0; round--) {
    // InvShiftRows
    const t1 = state[13]!
    state[13] = state[9]!
    state[9] = state[5]!
    state[5] = state[1]!
    state[1] = t1

    const t2 = state[10]!
    const t6 = state[14]!
    state[10] = state[2]!
    state[14] = state[6]!
    state[2] = t2
    state[6] = t6

    const t3 = state[3]!
    state[3] = state[7]!
    state[7] = state[11]!
    state[11] = state[15]!
    state[15] = t3

    // InvSubBytes
    for (let i = 0; i < 16; i++) {
      state[i] = SBOX_INV[state[i]!]!
    }

    // AddRoundKey
    const roundKey = expandedKey.subarray(round * 16, (round + 1) * 16)
    for (let i = 0; i < 16; i++) {
      state[i]! ^= roundKey[i]!
    }

    // InvMixColumns (skip in last round)
    if (round > 0) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4
        const s0 = state[i]!
        const s1 = state[i + 1]!
        const s2 = state[i + 2]!
        const s3 = state[i + 3]!
        state[i] = gmul(s0, 14) ^ gmul(s1, 11) ^ gmul(s2, 13) ^ gmul(s3, 9)
        state[i + 1] = gmul(s0, 9) ^ gmul(s1, 14) ^ gmul(s2, 11) ^ gmul(s3, 13)
        state[i + 2] = gmul(s0, 13) ^ gmul(s1, 9) ^ gmul(s2, 14) ^ gmul(s3, 11)
        state[i + 3] = gmul(s0, 11) ^ gmul(s1, 13) ^ gmul(s2, 9) ^ gmul(s3, 14)
      }
    }
  }

  return state
}

// PKCS7 padding
function pkcs7Pad(data: Uint8Array, blockSize: number) {
  const padding = blockSize - (data.length % blockSize)
  const padded = new Uint8Array(data.length + padding)
  padded.set(data)
  padded.fill(padding, data.length)
  return padded
}

function pkcs7Unpad(data: Uint8Array) {
  const padding = data[data.length - 1]!
  if (padding > 16 || padding === 0) {
    throw new Error('Invalid padding')
  }
  for (let i = data.length - padding; i < data.length; i++) {
    if (data[i] !== padding) {
      throw new Error('Invalid padding')
    }
  }
  return data.subarray(0, data.length - padding)
}

// AES-CBC encrypt (pure JS fallback)
function aesCbcEncryptFallback(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
) {
  const expandedKey = aesKeyExpansion(key)
  const padded = pkcs7Pad(plaintext, 16)
  const ciphertext = new Uint8Array(padded.length)
  let prevBlock = iv

  for (let i = 0; i < padded.length; i += 16) {
    const block = padded.slice(i, i + 16)
    // XOR with previous ciphertext block (or IV for first block)
    for (let j = 0; j < 16; j++) {
      block[j]! ^= prevBlock[j]!
    }
    const encrypted = aesEncryptBlock(block, expandedKey)
    ciphertext.set(encrypted, i)
    prevBlock = encrypted
  }

  return ciphertext
}

// AES-CBC decrypt (pure JS fallback)
function aesCbcDecryptFallback(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
) {
  const expandedKey = aesKeyExpansion(key)
  const plaintext = new Uint8Array(ciphertext.length)
  let prevBlock = iv

  for (let i = 0; i < ciphertext.length; i += 16) {
    const block = ciphertext.slice(i, i + 16)
    const decrypted = aesDecryptBlock(block, expandedKey)
    // XOR with previous ciphertext block (or IV for first block)
    for (let j = 0; j < 16; j++) {
      decrypted[j]! ^= prevBlock[j]!
    }
    plaintext.set(decrypted, i)
    prevBlock = block
  }

  return pkcs7Unpad(plaintext)
}

// Generate random bytes (works in both secure and non-secure contexts)
function getRandomBytes(length: number) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint8Array(length))
  }
  // Fallback for environments without crypto.getRandomValues
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
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
): { key: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer> } {
  const result = new Uint8Array(keyLen + ivLen)
  let offset = 0
  let prevHash: Uint8Array = new Uint8Array(0)

  while (offset < keyLen + ivLen) {
    const data = new Uint8Array(prevHash.length + password.length + salt.length)
    data.set(prevHash)
    data.set(password, prevHash.length)
    data.set(salt, prevHash.length + password.length)
    prevHash = md5(data)
    result.set(
      prevHash.subarray(0, Math.min(16, keyLen + ivLen - offset)),
      offset,
    )
    offset += 16
  }

  return {
    key: result.slice(0, keyLen),
    iv: result.slice(keyLen, keyLen + ivLen),
  }
}

// Convert string to Uint8Array (UTF-8)
function stringToBytes(str: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(str)
  // Return a copy with a fresh ArrayBuffer to satisfy TypeScript's strict typing
  return encoded.slice()
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
function base64Decode(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * AES encrypt compatible with crypto-js OpenSSL format
 * Uses Web Crypto API when available, falls back to pure JS in non-secure contexts
 */
export async function aesEncrypt(
  plaintext: string,
  password: string,
): Promise<string> {
  const salt = getRandomBytes(8)
  const { key, iv } = evpBytesToKey(stringToBytes(password), salt, 32, 16)

  let encrypted: Uint8Array
  if (isWebCryptoAvailable()) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CBC' },
      false,
      ['encrypt'],
    )
    // Web Crypto API handles PKCS7 padding automatically
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      stringToBytes(plaintext),
    )
    encrypted = new Uint8Array(encryptedBuffer)
  } else {
    // Fallback to pure JS implementation
    encrypted = aesCbcEncryptFallback(stringToBytes(plaintext), key, iv)
  }

  // Format: "Salted__" + salt + ciphertext, then Base64
  const saltPrefix = stringToBytes(SALT_PREFIX)
  const result = new Uint8Array(
    saltPrefix.length + salt.length + encrypted.byteLength,
  )
  result.set(saltPrefix)
  result.set(salt, saltPrefix.length)
  result.set(encrypted, saltPrefix.length + salt.length)

  return base64Encode(result)
}

/**
 * AES decrypt compatible with crypto-js OpenSSL format
 * Uses Web Crypto API when available, falls back to pure JS in non-secure contexts
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

  const salt = data.slice(saltPrefix.length, saltPrefix.length + 8)
  const encrypted = data.slice(saltPrefix.length + 8)

  const { key, iv } = evpBytesToKey(stringToBytes(password), salt, 32, 16)

  let decrypted: Uint8Array
  if (isWebCryptoAvailable()) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CBC' },
      false,
      ['decrypt'],
    )
    // Web Crypto API handles PKCS7 padding automatically
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      encrypted,
    )
    decrypted = new Uint8Array(decryptedBuffer)
  } else {
    // Fallback to pure JS implementation
    decrypted = aesCbcDecryptFallback(encrypted, key, iv)
  }

  return bytesToString(decrypted)
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
