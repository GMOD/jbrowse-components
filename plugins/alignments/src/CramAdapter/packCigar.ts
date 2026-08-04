import type { CramRecord } from '@gmod/cram'

// Above this many ops, hand back a Uint32Array instead of a plain array.
//
// bam-js measured the crossover between the two at ~50-100 ops (see its
// src/record.ts) and CRAM straddles it: a short read produces one op, an ONT
// read thousands. Measured over this repo's fixtures, switching per read halves
// what a long read's memoized NUMERIC_CIGAR retains (1.96MB -> 0.98MB across the
// 37-read ONT slice) at no cost in construction time, while leaving short reads
// on the array path — there a Uint32Array is 2.4x the memory, because ~96 bytes
// of fixed overhead land on a one-element payload, and ~2x slower.
export const TYPED_CIGAR_MIN_OPS = 64

/**
 * Pack a CRAM record's alignment into the `(length << 4) | op` array the render
 * path reads.
 *
 * The walk itself is `CramRecord.forEachCigarOp` in @gmod/cram. CRAM stores no
 * CIGAR — it is reconstructed from the read features, and that reconstruction
 * is subtle enough (q/Q features carry no alignment position, a run of
 * single-base 'i' insertions is one I op, zero-length ops are dropped, adjacent
 * same-op runs merge) that it belongs next to the read features and the
 * samtools cross-check rather than here. This file is only the packing, which
 * is jbrowse's memory decision and not cram-js's — hence cram-js handing out a
 * walk rather than an array type it picked for us.
 *
 * Converting at the end rather than filling a preallocated Uint32Array keeps
 * one copy of the walk; the extra linear pass measured free.
 */
export function packCigar(
  record: Pick<CramRecord, 'forEachCigarOp'>,
): ArrayLike<number> {
  const ops: number[] = []
  record.forEachCigarOp((op, length) => {
    ops.push((length << 4) | op)
  })
  return ops.length >= TYPED_CIGAR_MIN_OPS ? Uint32Array.from(ops) : ops
}
