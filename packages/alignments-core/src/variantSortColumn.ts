export interface VariantSortColumn {
  type: 'basePair' | 'insertion'
  /** 0-based */
  pos: number
}

// VCF anchors an indel on the base before it, which every read matches. The
// pileup sort keys a deletion's carriers on any base their gap covers, and an
// insertion's on the reference base following the inserted ones. The shared
// suffix comes off first: a multi-allelic record pads every ALT to its longest
// REF, so `AC>ATC` is the insertion `A>AT`.
function alleleSortColumn(
  start: number,
  ref: string,
  alt: string,
): VariantSortColumn | undefined {
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
  return {
    type: shared === refEnd ? 'insertion' : 'basePair',
    pos: start + shared,
  }
}

/**
 * The pileup column a sort at a VCF record's variant keys on, from its 0-based
 * start, REF and ALTs. Undefined where no ALT spells out bases: a symbolic
 * allele, a breakend, `*` or `.`. Of several ALTs the leftmost column wins.
 */
export function variantSortColumn(
  start: number,
  ref: string,
  alts: readonly string[],
) {
  let best: VariantSortColumn | undefined
  for (const alt of alts) {
    const column = alleleSortColumn(start, ref.toUpperCase(), alt.toUpperCase())
    if (column && (!best || column.pos < best.pos)) {
      best = column
    }
  }
  return best
}
