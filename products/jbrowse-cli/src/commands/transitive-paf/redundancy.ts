import type { PafRow } from './paf.ts'

/**
 * Drop composed alignments that restate ground already covered.
 *
 * Composition through a pivot multiplies coverage DEPTH, not just count. Two
 * haplotypes each align to a reference ~1.1x redundantly overall, but a repeat
 * locus where one has 200 alignments and the other 200 composes to 40,000 rows,
 * all saying the same thing about the same few kb. Measured on one chromosome of
 * the HPRC vs-GRCh38 alignment: 4,663 input rows composed to 225,626, of which
 * 9,084 carry essentially all of the coverage.
 *
 * Longest first, a row is kept only if it reaches ground the kept set does not
 * already hold. That is scale-free in a way a bp threshold is not — the useful
 * composed blocks on HPRC are LONGER than the input alignments that made them,
 * so no `--min-length` can separate signal from pileup on both that and a 5 Mb
 * bacterial genome. Genuine paralogy survives: a second copy at a different
 * locus is uncovered ground.
 *
 * `maxCovered` of 1 disables it — every composition is kept, which is what a
 * caller wanting the complete multi-mapping picture asks for.
 */
export function dropRedundant(rows: PafRow[], maxCovered: number) {
  if (maxCovered >= 1) {
    return rows
  }
  // Longest first, ties broken on coordinates so the choice is a property of the
  // alignments rather than of the order they were composed in.
  const order = [...rows].sort(
    (x, y) =>
      y.qend - y.qstart - (x.qend - x.qstart) ||
      x.qstart - y.qstart ||
      x.tstart - y.tstart,
  )
  // Kept spans per query sequence, held sorted and merged so the covered-so-far
  // test is a walk of the few intervals that reach the candidate.
  const covered = new Map<string, { start: number; end: number }[]>()
  const keep = new Set<PafRow>()
  for (const row of order) {
    let merged = covered.get(row.qname)
    if (!merged) {
      merged = []
      covered.set(row.qname, merged)
    }
    let overlap = 0
    for (const iv of merged) {
      if (iv.end <= row.qstart) {
        continue
      }
      if (iv.start >= row.qend) {
        break
      }
      overlap += Math.min(iv.end, row.qend) - Math.max(iv.start, row.qstart)
    }
    if (overlap >= maxCovered * (row.qend - row.qstart)) {
      continue
    }
    keep.add(row)
    // insert and coalesce, keeping the list sorted by start
    let i = 0
    while (i < merged.length && merged[i]!.start < row.qstart) {
      i++
    }
    merged.splice(i, 0, { start: row.qstart, end: row.qend })
    let w = 0
    for (let r = 1; r < merged.length; r++) {
      if (merged[r]!.start <= merged[w]!.end) {
        merged[w]!.end = Math.max(merged[w]!.end, merged[r]!.end)
      } else {
        merged[++w] = merged[r]!
      }
    }
    merged.length = w + 1
  }
  // Emitted in the order they were composed, not longest-first: the file stays
  // in pivot order, which is what make-pif's sort expects to find already close.
  return rows.filter(r => keep.has(r))
}
