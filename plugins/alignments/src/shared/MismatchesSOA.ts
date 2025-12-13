// Mismatch type encoding
// Non-interbase types (0-2), interbase types have bit 0x4 set (4-6)
export const TYPE_MISMATCH = 0
export const TYPE_DELETION = 1
export const TYPE_SKIP = 2
export const TYPE_INSERTION = 4 // interbase (bit 0x4)
export const TYPE_SOFTCLIP = 5 // interbase (bit 0x4)
export const TYPE_HARDCLIP = 6 // interbase (bit 0x4)

// Bitmask for interbase type check: (type & INTERBASE_BIT) !== 0
export const INTERBASE_BIT = 4

// Character code constants for bases
export const CHAR_STAR = 42 // '*' - deletion marker
export const CHAR_PLUS = 43 // '+' - insertion placeholder
export const CHAR_H = 72 // 'H' - hardclip
export const CHAR_N = 78 // 'N' - skip/unknown base
export const CHAR_S = 83 // 'S' - softclip
export const CHAR_X = 88 // 'X' - unknown/fallback

// Pre-computed lookup table for char code -> string conversion
// Use direct array access in hot loops: CHAR_CODE_TO_STRING[code]
// Covers ASCII range 0-127 which includes all base characters
export const CHAR_CODE_TO_STRING: string[] = []
for (let i = 0; i < 128; i++) {
  CHAR_CODE_TO_STRING[i] = String.fromCharCode(i)
}

export const TYPE_NAMES = [
  'mismatch', // 0
  'deletion', // 1
  'skip', // 2
  undefined, // 3 (unused)
  'insertion', // 4
  'softclip', // 5
  'hardclip', // 6
] as const

export type MismatchType = (typeof TYPE_NAMES)[number]

/**
 * Struct-of-Arrays representation of mismatches for better memory efficiency.
 *
 * Field semantics:
 * - starts: reference position offset from feature start
 * - lengths: the relevant length for each type:
 *   - mismatches: 1
 *   - insertions: insertion length (number of inserted bases)
 *   - deletions: deletion length (bases consumed on reference)
 *   - skips: skip length (bases consumed on reference)
 *   - softclip/hardclip: clip length
 * - types: TYPE_* constants (0-5)
 * - bases: always a char code (e.g., 65 for 'A', 42 for '*', 78 for 'N', 43 for '+')
 * - quals: quality score (0 if not available)
 * - altbases: reference base char code for mismatches (0 if not applicable)
 * - insertedBases: Map from index to inserted sequence string (only for insertions)
 * - hasSkips: true if any TYPE_SKIP entries exist (used for MD tag parsing)
 */
export interface MismatchesSOA {
  count: number
  starts: Uint32Array
  lengths: Uint32Array
  types: Uint8Array
  bases: Uint8Array
  quals: Uint8Array
  altbases: Uint8Array
  /** Map from index to inserted bases string (only populated for insertions) */
  insertedBases: Map<number, string>
  /** True if any skip (N) operations exist */
  hasSkips: boolean
}

export function createMismatchesSOA(capacity: number): MismatchesSOA {
  return {
    count: 0,
    starts: new Uint32Array(capacity),
    lengths: new Uint32Array(capacity),
    types: new Uint8Array(capacity),
    bases: new Uint8Array(capacity),
    quals: new Uint8Array(capacity),
    altbases: new Uint8Array(capacity),
    insertedBases: new Map(),
    hasSkips: false,
  }
}

export function growMismatchesSOA(soa: MismatchesSOA): MismatchesSOA {
  const newCapacity = soa.starts.length * 2
  const newStarts = new Uint32Array(newCapacity)
  const newLengths = new Uint32Array(newCapacity)
  const newTypes = new Uint8Array(newCapacity)
  const newBases = new Uint8Array(newCapacity)
  const newQuals = new Uint8Array(newCapacity)
  const newAltbases = new Uint8Array(newCapacity)

  newStarts.set(soa.starts)
  newLengths.set(soa.lengths)
  newTypes.set(soa.types)
  newBases.set(soa.bases)
  newQuals.set(soa.quals)
  newAltbases.set(soa.altbases)

  return {
    count: soa.count,
    starts: newStarts,
    lengths: newLengths,
    types: newTypes,
    bases: newBases,
    quals: newQuals,
    altbases: newAltbases,
    insertedBases: soa.insertedBases,
    hasSkips: soa.hasSkips,
  }
}

export function pushMismatch(
  soa: MismatchesSOA,
  start: number,
  length: number,
  type: number,
  base: number,
  qual: number,
  altbase: number,
  insertedBases?: string,
): MismatchesSOA {
  let result = soa
  if (soa.count >= soa.starts.length) {
    result = growMismatchesSOA(soa)
  }
  const idx = result.count
  result.starts[idx] = start
  result.lengths[idx] = length
  result.types[idx] = type
  result.bases[idx] = base
  result.quals[idx] = qual
  result.altbases[idx] = altbase
  if (insertedBases !== undefined) {
    result.insertedBases.set(idx, insertedBases)
  }
  result.count++
  return result
}

export function trimMismatchesSOA(soa: MismatchesSOA): MismatchesSOA {
  if (soa.count === soa.starts.length) {
    return soa
  }
  return {
    count: soa.count,
    starts: soa.starts.subarray(0, soa.count),
    lengths: soa.lengths.subarray(0, soa.count),
    types: soa.types.subarray(0, soa.count),
    bases: soa.bases.subarray(0, soa.count),
    quals: soa.quals.subarray(0, soa.count),
    altbases: soa.altbases.subarray(0, soa.count),
    insertedBases: soa.insertedBases,
    hasSkips: soa.hasSkips,
  }
}

/**
 * Legacy Mismatch interface for backward compatibility.
 * Mirrors the Mismatch interface from shared/types.ts but with string type
 * for flexibility when converting from third-party adapters.
 */
export interface Mismatch {
  qual?: number
  start: number
  length: number
  insertedBases?: string
  type: string
  base: string
  altbase?: string
  cliplen?: number
}

const TYPE_NAME_TO_CODE: Record<string, number> = {
  mismatch: TYPE_MISMATCH,
  insertion: TYPE_INSERTION,
  deletion: TYPE_DELETION,
  skip: TYPE_SKIP,
  softclip: TYPE_SOFTCLIP,
  hardclip: TYPE_HARDCLIP,
}

function isMismatchesSOA(
  data: MismatchesSOA | Mismatch[] | undefined,
): data is MismatchesSOA {
  return (
    data !== undefined &&
    !Array.isArray(data) &&
    typeof data.count === 'number' &&
    data.starts instanceof Uint32Array
  )
}

function convertLegacyMismatchesToSOA(mismatches: Mismatch[]): MismatchesSOA {
  const len = mismatches.length
  let hasSkips = false
  const soa: MismatchesSOA = {
    count: len,
    starts: new Uint32Array(len),
    lengths: new Uint32Array(len),
    types: new Uint8Array(len),
    bases: new Uint8Array(len),
    quals: new Uint8Array(len),
    altbases: new Uint8Array(len),
    insertedBases: new Map(),
    hasSkips: false,
  }

  for (let i = 0; i < len; i++) {
    const m = mismatches[i]!
    const type = TYPE_NAME_TO_CODE[m.type] ?? TYPE_MISMATCH
    soa.starts[i] = m.start
    soa.types[i] = type

    if (type === TYPE_SKIP) {
      hasSkips = true
    }

    // For interbase types (insertion/softclip/hardclip), length is in cliplen or insertedBases
    // For others (mismatch/deletion/skip), length is in the length field
    soa.lengths[i] =
      (type & INTERBASE_BIT) !== 0
        ? (m.cliplen ?? m.insertedBases?.length ?? 0)
        : m.length

    // bases always stores a char code
    // For insertions with multi-char base (e.g. "123"), use '+' as placeholder
    soa.bases[i] =
      type === TYPE_INSERTION && m.base.length > 1
        ? CHAR_PLUS
        : m.base.charCodeAt(0)

    soa.quals[i] = m.qual ?? 0
    soa.altbases[i] = m.altbase ? m.altbase.charCodeAt(0) : 0

    if (m.insertedBases !== undefined) {
      soa.insertedBases.set(i, m.insertedBases)
    }
  }

  soa.hasSkips = hasSkips
  return soa
}

function toMismatchesSOA(
  data: MismatchesSOA | Mismatch[] | undefined,
): MismatchesSOA | undefined {
  if (data === undefined) {
    return undefined
  }
  if (isMismatchesSOA(data)) {
    return data
  }
  if (Array.isArray(data) && data.length > 0) {
    return convertLegacyMismatchesToSOA(data)
  }
  if (Array.isArray(data) && data.length === 0) {
    return createMismatchesSOA(0)
  }
  return undefined
}

/**
 * Convert MismatchesSOA back to legacy Mismatch[] format.
 * Useful for testing and compatibility with code expecting the old format.
 */
export function toMismatchesArray(soa: MismatchesSOA): Mismatch[] {
  const result: Mismatch[] = new Array(soa.count)
  for (let i = 0; i < soa.count; i++) {
    const type = soa.types[i]!
    const typeName = TYPE_NAMES[type] || 'mismatch'
    const baseCode = soa.bases[i]!
    const altbaseCode = soa.altbases[i]!
    const length = soa.lengths[i]!

    // Reconstruct base string based on type
    let base: string
    if (type === TYPE_INSERTION) {
      base = String(length)
    } else if (type === TYPE_SOFTCLIP) {
      base = `S${length}`
    } else if (type === TYPE_HARDCLIP) {
      base = `H${length}`
    } else {
      base = CHAR_CODE_TO_STRING[baseCode]!
    }

    const mismatch: Mismatch = {
      start: soa.starts[i]!,
      length:
        type === TYPE_DELETION || type === TYPE_SKIP
          ? length
          : type === TYPE_MISMATCH
            ? 1
            : 0,
      type: typeName,
      base,
    }

    if (soa.quals[i]) {
      mismatch.qual = soa.quals[i]
    }
    if (altbaseCode !== 0) {
      mismatch.altbase = CHAR_CODE_TO_STRING[altbaseCode]
    }
    if (type === TYPE_SOFTCLIP || type === TYPE_HARDCLIP) {
      mismatch.cliplen = length
    }
    const insertedBases = soa.insertedBases.get(i)
    if (insertedBases !== undefined) {
      mismatch.insertedBases = insertedBases
    }

    result[i] = mismatch
  }
  return result
}

/**
 * Get mismatches from a feature, preferring NUMERIC_MISMATCHES (SOA format)
 * and falling back to converting legacy mismatches array.
 *
 * Usage: const mismatches = getMismatchesFromFeature(feature)
 */
export function getMismatchesFromFeature(feature: {
  get: (field: string) => unknown
}): MismatchesSOA | undefined {
  const numeric = feature.get('NUMERIC_MISMATCHES') as MismatchesSOA | undefined
  if (numeric) {
    return numeric
  }
  return toMismatchesSOA(feature.get('mismatches') as Mismatch[] | undefined)
}
