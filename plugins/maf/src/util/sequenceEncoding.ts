// 4-bit packed sequence encoding
// Packs 2 bases per byte for 4x memory savings over JS strings
// Preserves case information

// Encoding: 4 bits per base
// 0-6: lowercase a, c, g, t, n, -, space
// 7-11: uppercase A, C, G, T, N
// 12+: unknown/other

// Uint8Array lookup table for fast charCode -> 4-bit code conversion
// ~6x faster than object property lookup
const CHAR_TO_CODE = new Uint8Array(128)
CHAR_TO_CODE.fill(12) // default: unknown
CHAR_TO_CODE[97] = 0 // a
CHAR_TO_CODE[99] = 1 // c
CHAR_TO_CODE[103] = 2 // g
CHAR_TO_CODE[116] = 3 // t
CHAR_TO_CODE[110] = 4 // n
CHAR_TO_CODE[45] = 5 // -
CHAR_TO_CODE[32] = 6 // space
CHAR_TO_CODE[65] = 7 // A
CHAR_TO_CODE[67] = 8 // C
CHAR_TO_CODE[71] = 9 // G
CHAR_TO_CODE[84] = 10 // T
CHAR_TO_CODE[78] = 11 // N

const DECODE_MAP = ['a', 'c', 'g', 't', 'n', '-', ' ', 'A', 'C', 'G', 'T', 'N']

// Lowercase versions for quick lookup (codes 0-6 are already lowercase, 7-11 need mapping)
const DECODE_MAP_LOWER = [
  'a',
  'c',
  'g',
  't',
  'n',
  '-',
  ' ',
  'a',
  'c',
  'g',
  't',
  'n',
]

export interface EncodedSequence {
  data: Uint8Array
  length: number // Original sequence length (needed since we pack 2 per byte)
}

export function encodeSequence(seq: string): EncodedSequence {
  const length = seq.length
  const data = new Uint8Array(Math.ceil(length / 2))

  for (let i = 0; i < length; i += 2) {
    const code1 = CHAR_TO_CODE[seq.charCodeAt(i)]!
    const code2 = i + 1 < length ? CHAR_TO_CODE[seq.charCodeAt(i + 1)]! : 0
    // Pack: first base in high nibble, second in low nibble
    data[i >> 1] = (code1 << 4) | code2
  }

  return { data, length }
}

// Decode a single base at index (preserves original case)
export function decodeBase(encoded: EncodedSequence, index: number): string {
  if (index < 0 || index >= encoded.length) {
    return ''
  }
  const byteIndex = index >> 1
  const byte = encoded.data[byteIndex]!
  // Even index = high nibble, odd index = low nibble
  const code = index & 1 ? byte & 0x0f : byte >> 4
  return DECODE_MAP[code] ?? '?'
}

// Decode a single base at index (always lowercase)
export function decodeBaseLower(
  encoded: EncodedSequence,
  index: number,
): string {
  if (index < 0 || index >= encoded.length) {
    return ''
  }
  const byteIndex = index >> 1
  const byte = encoded.data[byteIndex]!
  const code = index & 1 ? byte & 0x0f : byte >> 4
  return DECODE_MAP_LOWER[code] ?? '?'
}

// Get the raw 4-bit code at index (for fast comparisons)
export function getBaseCode(encoded: EncodedSequence, index: number): number {
  if (index < 0 || index >= encoded.length) {
    return 12
  }
  const byteIndex = index >> 1
  const byte = encoded.data[byteIndex]!
  return index & 1 ? byte & 0x0f : byte >> 4
}

// Check if base at index is a gap
export function isGap(encoded: EncodedSequence, index: number): boolean {
  return getBaseCode(encoded, index) === 5
}

// Check if base at index is a space
export function isSpace(encoded: EncodedSequence, index: number): boolean {
  return getBaseCode(encoded, index) === 6
}

// Get lowercase code for comparison (maps uppercase codes 7-11 to lowercase 0-4)
export function getLowerCode(code: number): number {
  return code >= 7 && code <= 11 ? code - 7 : code
}

// Compare two bases for equality (case-insensitive)
export function basesEqualIgnoreCase(code1: number, code2: number): boolean {
  return getLowerCode(code1) === getLowerCode(code2)
}

// Decode full sequence to string (for cases where string is needed, e.g., FASTA export)
export function decodeSequence(encoded: EncodedSequence): string {
  let result = ''
  for (let i = 0; i < encoded.length; i++) {
    result += decodeBase(encoded, i)
  }
  return result
}

// Decode to lowercase string
export function decodeSequenceLower(encoded: EncodedSequence): string {
  let result = ''
  for (let i = 0; i < encoded.length; i++) {
    result += decodeBaseLower(encoded, i)
  }
  return result
}

// Constants for direct code comparison
export const CODE_GAP = 5
export const CODE_SPACE = 6
export const CODE_A_LOWER = 0
export const CODE_C_LOWER = 1
export const CODE_G_LOWER = 2
export const CODE_T_LOWER = 3
export const CODE_N_LOWER = 4
