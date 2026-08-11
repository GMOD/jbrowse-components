// Shared types for callback-based mismatch iteration
// Each adapter implements forEachMismatch using its optimal internal structure
//
// The values are the ASCII codes of the CIGAR/CRAM letters they name, which is
// what lets `@gmod/cram`'s own forEachMismatch emit straight into one of these
// callbacks: it reports a difference by its CRAM feature code, so a CRAM
// adapter that agrees on the numbering needs no translating callback in
// between, and that indirect call was 17% of the walk. See @gmod/cram ADR 0008
// and CramSlightlyLazyFeature.forEachMismatch. `cramCodes.test.ts` pins the
// agreement.
//
// Nothing depends on them being 0..5 — every consumer compares symbolically
// and none of them is serialized — but do not renumber them without checking
// that again.
export const MISMATCH_TYPE = 0x58 // 'X'
export const INSERTION_TYPE = 0x49 // 'I'
export const DELETION_TYPE = 0x44 // 'D'
export const SKIP_TYPE = 0x4e // 'N'
export const SOFTCLIP_TYPE = 0x53 // 'S'
export const HARDCLIP_TYPE = 0x48 // 'H'

export type MismatchCallback = (
  type: number,
  start: number,
  length: number,
  base: string,
  qual: number | undefined,
  altbase: number | undefined,
  cliplen: number | undefined,
) => void
