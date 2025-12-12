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
