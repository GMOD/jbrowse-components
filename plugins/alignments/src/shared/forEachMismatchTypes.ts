// Shared types for callback-based mismatch iteration
// Each adapter implements forEachMismatch using its optimal internal structure

export const MISMATCH_TYPE = 0
export const INSERTION_TYPE = 1
export const DELETION_TYPE = 2
export const SKIP_TYPE = 3
export const SOFTCLIP_TYPE = 4
export const HARDCLIP_TYPE = 5

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
