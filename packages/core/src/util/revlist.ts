/**
 * Flip a list of intervals onto the opposite strand of a `seqlen`-long
 * sequence, returning them in ascending order. Every field other than
 * start/end is carried through, so a CDS keeps its phase and type.
 *
 * Its own module because both the sequence helpers and `geneticCodes` need it,
 * and `geneticCodes` importing `seqUtils` for it is what made the two mutually
 * dependent — see the codon-table note in geneticCodes.ts.
 */
export function revlist<T extends { start: number; end: number }>(
  list: T[],
  seqlen: number,
): T[] {
  return list
    .map(sub => ({ ...sub, start: seqlen - sub.end, end: seqlen - sub.start }))
    .sort((a, b) => a.start - b.start)
}
