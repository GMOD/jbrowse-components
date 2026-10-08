export interface VariantSortColumn {
  type: 'basePair' | 'insertion'
  /** 0-based */
  pos: number
}

/**
 * What a read carrying a variant's ALT has at its sort column. At a `basePair`
 * column, that base, or `*` where the ALT deletes it. At an `insertion` column,
 * an insertion of at least `minInsertion` bases within `within` bases of it: an
 * aligner places a long insertion wherever in a repeat it scores best, often
 * tens of bases from the caller's position.
 */
export type VariantAllele =
  | { base: string }
  | { minInsertion: number; within: number }

/**
 * A VCF record's sort column, and what the ALT it was taken from has there: its
 * base at a `basePair` column (`*` where it deletes that base), the number of
 * bases it inserts at an `insertion` one.
 */
export interface VariantCall {
  column: VariantSortColumn
  carried: { base: string } | { inserted: number }
}

// VCF anchors an indel on the base before it, which every read matches. The
// pileup sort keys a deletion's carriers on any base their gap covers, and an
// insertion's on the reference base following the inserted ones. The shared
// suffix comes off first: a multi-allelic record pads every ALT to its longest
// REF, so `AC>ATC` is the insertion `A>AT`.
function alleleCall(
  start: number,
  ref: string,
  alt: string,
): VariantCall | undefined {
  if (!/^[ACGTN]+$/.test(alt) || alt === ref) {
    return undefined
  }
  let refEnd = ref.length
  let altEnd = alt.length
  while (refEnd > 1 && altEnd > 1 && ref[refEnd - 1] === alt[altEnd - 1]) {
    refEnd--
    altEnd--
  }
  let shared = 0
  while (shared < refEnd && shared < altEnd && ref[shared] === alt[shared]) {
    shared++
  }
  return shared === refEnd
    ? {
        column: { type: 'insertion', pos: start + shared },
        carried: { inserted: altEnd - shared },
      }
    : {
        column: { type: 'basePair', pos: start + shared },
        carried: { base: shared < altEnd ? alt[shared]! : '*' },
      }
}

/**
 * The pileup column a sort at a VCF record's variant keys on, with what its ALT
 * has there, from its 0-based start, REF and ALTs. Undefined where no ALT
 * spells out bases: a symbolic allele, a breakend, `*` or `.`. Of several ALTs
 * the leftmost column wins.
 */
export function variantCall(
  start: number,
  ref: string,
  alts: readonly string[],
) {
  let best: VariantCall | undefined
  for (const alt of alts) {
    const call = alleleCall(start, ref.toUpperCase(), alt.toUpperCase())
    if (call && (!best || call.column.pos < best.column.pos)) {
      best = call
    }
  }
  return best
}

/** The column of `variantCall`, for a caller that only sorts */
export function variantSortColumn(
  start: number,
  ref: string,
  alts: readonly string[],
) {
  return variantCall(start, ref, alts)?.column
}
