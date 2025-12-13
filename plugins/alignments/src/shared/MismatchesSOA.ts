// Mismatch type encoding
export const TYPE_MISMATCH = 0
export const TYPE_INSERTION = 1
export const TYPE_DELETION = 2
export const TYPE_SKIP = 3
export const TYPE_SOFTCLIP = 4
export const TYPE_HARDCLIP = 5

export const TYPE_NAMES = [
  'mismatch',
  'insertion',
  'deletion',
  'skip',
  'softclip',
  'hardclip',
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
  }
}

/**
 * Legacy Mismatch interface for backward compatibility.
 * Mirrors the Mismatch interface from shared/types.ts but with string type
 * for flexibility when converting from third-party adapters.
 */
interface Mismatch {
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
    typeof (data as MismatchesSOA).count === 'number' &&
    (data as MismatchesSOA).starts instanceof Uint32Array
  )
}

function convertToMismatchesSOA(mismatches: Mismatch[]): MismatchesSOA {
  const len = mismatches.length
  const soa: MismatchesSOA = {
    count: len,
    starts: new Uint32Array(len),
    lengths: new Uint32Array(len),
    types: new Uint8Array(len),
    bases: new Uint8Array(len),
    quals: new Uint8Array(len),
    altbases: new Uint8Array(len),
    insertedBases: new Map(),
  }

  for (let i = 0; i < len; i++) {
    const m = mismatches[i]!
    const type = TYPE_NAME_TO_CODE[m.type] ?? TYPE_MISMATCH
    soa.starts[i] = m.start
    soa.types[i] = type

    // Determine length based on type
    if (type === TYPE_INSERTION || type === TYPE_SOFTCLIP || type === TYPE_HARDCLIP) {
      soa.lengths[i] = m.cliplen ?? m.insertedBases?.length ?? 0
    } else {
      soa.lengths[i] = m.length
    }

    // bases always stores a char code
    if (m.base.length === 1) {
      soa.bases[i] = m.base.charCodeAt(0)
    } else if (type === TYPE_INSERTION) {
      soa.bases[i] = 43 // '+' char code as placeholder for insertions
    } else if (type === TYPE_SOFTCLIP || type === TYPE_HARDCLIP) {
      soa.bases[i] = m.base.charCodeAt(0)
    } else {
      soa.bases[i] = m.base.charCodeAt(0)
    }

    soa.quals[i] = m.qual ?? 0
    soa.altbases[i] = m.altbase ? m.altbase.charCodeAt(0) : 0

    if (m.insertedBases !== undefined) {
      soa.insertedBases.set(i, m.insertedBases)
    }
  }

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
    return convertToMismatchesSOA(data)
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
      base = String.fromCharCode(baseCode)
    }

    const mismatch: Mismatch = {
      start: soa.starts[i]!,
      length: type === TYPE_DELETION || type === TYPE_SKIP ? length : (type === TYPE_MISMATCH ? 1 : 0),
      type: typeName,
      base,
    }

    if (soa.quals[i]) {
      mismatch.qual = soa.quals[i]
    }
    if (altbaseCode !== 0) {
      mismatch.altbase = String.fromCharCode(altbaseCode)
    }
    if (type === TYPE_SOFTCLIP || type === TYPE_HARDCLIP) {
      mismatch.cliplen = length
    }
    if (soa.insertedBases[i] !== undefined) {
      mismatch.insertedBases = soa.insertedBases[i]
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
  const numeric = feature.get('NUMERIC_MISMATCHES') as
    | MismatchesSOA
    | undefined
  if (numeric) {
    return numeric
  }
  return toMismatchesSOA(feature.get('mismatches') as Mismatch[] | undefined)
}
