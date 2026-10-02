export const DASH = 45
export const SPACE = 32
export const LOWER_BIT = 0x20
export const N_UPPER = 78

/** No base at this column of a row: a gap, or the padding of a short row. */
export function isGapByte(b: number) {
  return b === DASH || b === SPACE
}

export function sameBase(a: number, b: number) {
  return (a | LOWER_BIT) === (b | LOWER_BIT)
}

/**
 * An `N` reference base, which a row neither matches nor mismatches, so
 * identity leaves it uncounted.
 */
export function isUnknownBase(b: number) {
  return (b & ~LOWER_BIT) === N_UPPER
}

/**
 * The first column carrying the row's own sequence. A gap run reaching either
 * end of a row measures where the block was cut, not the alignment.
 */
export function firstDrawn(bytes: Uint8Array, at: number, len: number) {
  let first = 0
  while (first < len && isGapByte(bytes[at + first]!)) {
    first++
  }
  return first
}

/** The last column carrying the row's own sequence, from `firstDrawn`'s answer. */
export function lastDrawn(
  bytes: Uint8Array,
  at: number,
  len: number,
  first: number,
) {
  let last = len - 1
  while (last > first && isGapByte(bytes[at + last]!)) {
    last--
  }
  return last
}
