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

export interface MismatchesSOA {
  count: number
  starts: Uint32Array
  lengths: Uint32Array
  types: Uint8Array
  bases: Uint8Array
  quals: Uint8Array
  altbases: Uint8Array
  clipLens: Uint32Array
  insertedBases: string[]
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
    clipLens: new Uint32Array(capacity),
    insertedBases: [],
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
  const newClipLens = new Uint32Array(newCapacity)

  newStarts.set(soa.starts)
  newLengths.set(soa.lengths)
  newTypes.set(soa.types)
  newBases.set(soa.bases)
  newQuals.set(soa.quals)
  newAltbases.set(soa.altbases)
  newClipLens.set(soa.clipLens)

  return {
    count: soa.count,
    starts: newStarts,
    lengths: newLengths,
    types: newTypes,
    bases: newBases,
    quals: newQuals,
    altbases: newAltbases,
    clipLens: newClipLens,
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
  clipLen: number,
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
  result.clipLens[idx] = clipLen
  if (insertedBases !== undefined) {
    result.insertedBases[idx] = insertedBases
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
    clipLens: soa.clipLens.subarray(0, soa.count),
    insertedBases: soa.insertedBases,
  }
}

// Old Mismatch interface for backward compatibility
interface LegacyMismatch {
  qual?: number
  start: number
  length: number
  insertedBases?: string
  type: string
  base: string
  altbase?: string
  cliplen?: number
}

// Type name to type code mapping
const TYPE_NAME_TO_CODE: Record<string, number> = {
  mismatch: TYPE_MISMATCH,
  insertion: TYPE_INSERTION,
  deletion: TYPE_DELETION,
  skip: TYPE_SKIP,
  softclip: TYPE_SOFTCLIP,
  hardclip: TYPE_HARDCLIP,
}

// Type guard to check if data is already in SOA format
export function isMismatchesSOA(
  data: MismatchesSOA | LegacyMismatch[] | undefined,
): data is MismatchesSOA {
  return (
    data !== undefined &&
    !Array.isArray(data) &&
    typeof (data as MismatchesSOA).count === 'number' &&
    (data as MismatchesSOA).starts instanceof Uint32Array
  )
}

// Convert legacy Mismatch[] to MismatchesSOA
export function convertToMismatchesSOA(
  mismatches: LegacyMismatch[],
): MismatchesSOA {
  const len = mismatches.length
  const soa: MismatchesSOA = {
    count: len,
    starts: new Uint32Array(len),
    lengths: new Uint32Array(len),
    types: new Uint8Array(len),
    bases: new Uint8Array(len),
    quals: new Uint8Array(len),
    altbases: new Uint8Array(len),
    clipLens: new Uint32Array(len),
    insertedBases: [],
  }

  for (let i = 0; i < len; i++) {
    const m = mismatches[i]!
    soa.starts[i] = m.start
    soa.lengths[i] = m.length
    soa.types[i] = TYPE_NAME_TO_CODE[m.type] ?? TYPE_MISMATCH

    // Handle base - could be a single char or a number string for insertions
    if (m.base.length === 1) {
      soa.bases[i] = m.base.charCodeAt(0)
    } else {
      // For insertions, base is the length as string (e.g., "5")
      const parsed = Number.parseInt(m.base, 10)
      soa.bases[i] = Number.isNaN(parsed) ? m.base.charCodeAt(0) : parsed
    }

    soa.quals[i] = m.qual ?? 0
    soa.altbases[i] = m.altbase ? m.altbase.charCodeAt(0) : 0
    soa.clipLens[i] = m.cliplen ?? 0

    if (m.insertedBases !== undefined) {
      soa.insertedBases[i] = m.insertedBases
    }
  }

  return soa
}

// Normalize mismatches data to SOA format, handling both old and new formats
export function toMismatchesSOA(
  data: MismatchesSOA | LegacyMismatch[] | undefined,
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
  // Empty array case
  if (Array.isArray(data) && data.length === 0) {
    return createMismatchesSOA(0)
  }
  return undefined
}

// Convert MismatchesSOA back to legacy Mismatch[] format (for testing/compatibility)
export function toMismatchesArray(soa: MismatchesSOA): LegacyMismatch[] {
  const result: LegacyMismatch[] = new Array(soa.count)
  for (let i = 0; i < soa.count; i++) {
    const type = soa.types[i]!
    const typeName = TYPE_NAMES[type] || 'mismatch'
    const baseCode = soa.bases[i]!
    const altbaseCode = soa.altbases[i]!
    const clipLen = soa.clipLens[i]!

    // Handle base conversion
    let base: string
    if (type === TYPE_INSERTION) {
      base = String(clipLen)
    } else if (type === TYPE_SOFTCLIP) {
      base = `S${clipLen}`
    } else if (type === TYPE_HARDCLIP) {
      base = `H${clipLen}`
    } else if (baseCode >= 32 && baseCode <= 126) {
      base = String.fromCharCode(baseCode)
    } else {
      base = String(baseCode)
    }

    const mismatch: LegacyMismatch = {
      start: soa.starts[i]!,
      length: soa.lengths[i]!,
      type: typeName,
      base,
    }

    if (soa.quals[i]) {
      mismatch.qual = soa.quals[i]
    }
    if (altbaseCode !== 0) {
      mismatch.altbase = String.fromCharCode(altbaseCode)
    }
    if (clipLen !== 0 && type !== TYPE_INSERTION) {
      mismatch.cliplen = clipLen
    }
    if (soa.insertedBases[i] !== undefined) {
      mismatch.insertedBases = soa.insertedBases[i]
    }

    result[i] = mismatch
  }
  return result
}

// Helper to get mismatches from a feature, preferring NUMERIC_MISMATCHES (SOA)
// and falling back to converting legacy mismatches array
export function getMismatchesFromFeature(feature: {
  get: (field: string) => unknown
}): MismatchesSOA | undefined {
  const numeric = feature.get('NUMERIC_MISMATCHES') as
    | MismatchesSOA
    | undefined
  if (numeric) {
    return numeric
  }
  return toMismatchesSOA(feature.get('mismatches') as LegacyMismatch[] | undefined)
}
