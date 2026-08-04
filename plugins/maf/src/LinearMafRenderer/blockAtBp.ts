/**
 * Locate the MAF block covering an absolute genomic position.
 *
 * A fetched region's blocks are genomically **disjoint and ascending** — one
 * BED/bigBed/TAF record per alignment stanza, delivered in index order — so at
 * most one contains a given bp and a binary search finds it. Worth having as a
 * search rather than a scan because the fetched region is the *buffered* one:
 * on the UCSC ce11 26-way shape that is tens of thousands of blocks (median
 * 7bp), and the two callers each pay the walk per mousemove or per codon.
 *
 * The `endBp` a block reports is `startBp` + its count of non-gap reference
 * bytes, so `[startBp, endBp)` is exactly the reference positions it can
 * resolve — the same bound a caller indexing the block's reference columns
 * would apply itself.
 */
export function blockIndexAtBp(
  blocks: readonly { startBp: number; endBp: number }[],
  bp: number,
): number {
  // Last block starting at or before `bp`.
  let lo = 0
  let hi = blocks.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (blocks[mid]!.startBp <= bp) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const idx = lo - 1
  return idx >= 0 && bp < blocks[idx]!.endBp ? idx : -1
}
