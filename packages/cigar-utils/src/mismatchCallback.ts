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

/**
 * Identical to `@gmod/bam`'s and `@gmod/cram`'s `MismatchCallback`, so a
 * consumer's callback goes straight to either walk with nothing in between.
 *
 * The last three are numbers rather than `number | undefined`: an absent
 * quality is -1, and an absent reference base or clip length is 0. That is
 * what both libraries emit, and it saves every consumer a non-null assertion.
 */
export type MismatchCallback = (
  type: number,
  start: number,
  length: number,
  base: string,
  qual: number,
  altbase: number,
  cliplen: number,
) => void

/**
 * The genomic viewport a `forEachMismatch` walk reports within: 0-based
 * half-open, and absolute even where the walk reports read-relative positions,
 * since it describes a region of the reference rather than a position in the
 * output.
 *
 * The narrow half of `@gmod/bam`'s and `@gmod/cram`'s `MismatchOptions` — the
 * part every alignment feature can honour, without this package having to know
 * about a packed reference or an origin.
 */
export interface MismatchWindow {
  start?: number
  end?: number
}
