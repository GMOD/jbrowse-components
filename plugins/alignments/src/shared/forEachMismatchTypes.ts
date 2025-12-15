// Shared types for callback-based mismatch iteration
// Each adapter implements forEachMismatch using its optimal internal structure

export const MISMATCH_TYPE = 0
export const INSERTION_TYPE = 1
export const DELETION_TYPE = 2
export const SKIP_TYPE = 3
export const SOFTCLIP_TYPE = 4
export const HARDCLIP_TYPE = 5

// Bitmask for interbase types (insertion, softclip, hardclip)
// These are events that occur between reference positions rather than at a position
// Computed as: (1 << INSERTION_TYPE) | (1 << SOFTCLIP_TYPE) | (1 << HARDCLIP_TYPE)
// = (1 << 1) | (1 << 4) | (1 << 5) = 2 | 16 | 32 = 50
export const INTERBASE_MASK = 0b110010

export const MISMATCH_MAP = [
  'mismatch',
  'insertion',
  'deletion',
  'skip',
  'softclip',
  'hardclip',
] as const

export const MISMATCH_REV_MAP = {
  mismatch: 0,
  insertion: 1,
  deletion: 2,
  skip: 3,
  softclip: 4,
  hardclip: 5,
} as const

export type MismatchCallback = (
  type: number,
  start: number,
  length: number,
  base: string,
  qual: number | undefined,
  altbase: number | undefined,
  cliplen: number | undefined,
) => void
