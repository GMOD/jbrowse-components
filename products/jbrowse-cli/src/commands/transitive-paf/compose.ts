import { flipCigar, swapIndelCigar } from '@jbrowse/cigar-utils'

import type { PafRow } from './paf.ts'

/**
 * One ungapped run of an alignment, stated against the TARGET axis: `len` bases
 * of the target starting at `t` correspond to `len` bases of the query starting
 * at base `q` and advancing by `step` (-1 on a reverse-strand alignment, where
 * PAF walks the query backwards from `qend`).
 *
 * Blocks rather than raw CIGARs are what makes composition tractable: two
 * alignments sharing a target can be intersected on that one axis, and the
 * result is again a list of blocks. Composing the CIGAR strings directly would
 * mean reasoning about four indel senses at once.
 */
export interface Block {
  t: number
  q: number
  step: 1 | -1
  len: number
}

/**
 * Walk a PAF row's CIGAR into ungapped blocks. PAF convention: the CIGAR is
 * written in target-forward order, and on the `-` strand the query is consumed
 * backwards from `qend` — the same walk `splitCigarOnLargeGaps` does.
 */
export function alignmentBlocks(row: PafRow): Block[] {
  const step = row.strand === '-' ? -1 : 1
  const out: Block[] = []
  let t = row.tstart
  // base index of the next query base to consume, in walk direction
  let q = row.strand === '-' ? row.qend - 1 : row.qstart
  let i = 0
  const { cigar } = row
  while (i < cigar.length) {
    let len = 0
    while (
      i < cigar.length &&
      cigar.charCodeAt(i) >= 48 &&
      cigar.charCodeAt(i) <= 57
    ) {
      len = len * 10 + cigar.charCodeAt(i++) - 48
    }
    const op = cigar[i++]!
    if (op === 'M' || op === '=' || op === 'X') {
      out.push({ t, q, step, len })
      t += len
      q += step * len
    } else if (op === 'D' || op === 'N') {
      t += len
    } else if (op === 'I') {
      q += step * len
    }
    // S/H/P consume neither axis in PAF
  }
  return out
}

/**
 * Re-state a row so that `pivot` is its target. A row whose pivot is already the
 * target passes through; otherwise query and target swap, which is the same
 * reorientation make-pif does when it writes a row's other perspective — reverse
 * the CIGAR on the `-` strand, swap indel sense on the `+`.
 *
 * Returns undefined when the row does not touch the pivot at all.
 */
export function orientToPivot(row: PafRow, pivot: string): PafRow | undefined {
  if (row.tname === pivot) {
    return row
  }
  if (row.qname !== pivot) {
    return undefined
  }
  return {
    ...row,
    qname: row.tname,
    qlen: row.tlen,
    qstart: row.tstart,
    qend: row.tend,
    tname: row.qname,
    tlen: row.qlen,
    tstart: row.qstart,
    tend: row.qend,
    cigar:
      row.strand === '-' ? flipCigar(row.cigar) : swapIndelCigar(row.cigar),
  }
}

/** A composed piece: `len` bases of A and of B, aligned to each other. */
interface Piece {
  // lowest B base of the piece, i.e. where it sits once the walk is put in
  // target-ascending order
  bLo: number
  // the A base paired with bLo
  aAtBLo: number
  len: number
}

/**
 * Compose two alignments that share a target ("pivot") into the alignment they
 * imply between their two queries: A-vs-R and B-vs-R give A-vs-B, with A as the
 * query and B as the target.
 *
 * This is the operation an all-vs-all PAF is missing when it is not actually
 * all-vs-all — a wfmash run with a `-p` threshold, or any "everything against
 * the reference" mapping. Without it a synteny band between two assemblies that
 * both align to a third, but not to each other, draws nothing.
 *
 * Returns undefined when the two do not overlap on the pivot, or when the
 * overlap yields fewer than `minAligned` aligned bases.
 *
 * The composed row's `numMatches` is an ESTIMATE: no sequence is available here,
 * so per-base identity cannot be recomputed. It is the product of the two input
 * identities over the aligned length — the independent-divergence assumption,
 * which is what any composition through an intermediate can promise. The row
 * carries a `vi:Z:` tag naming the pivot so a composed alignment is never
 * mistaken for a measured one.
 */
export function composeThroughPivot({
  a,
  b,
  minAligned = 0,
}: {
  a: PafRow
  b: PafRow
  minAligned?: number
}): PafRow | undefined {
  // Cheap reject before either CIGAR is walked; the caller sweeps in pivot order
  // so most candidate pairs die here.
  if (a.tstart >= b.tend || b.tstart >= a.tend) {
    return undefined
  }
  const aStep = a.strand === '-' ? -1 : 1
  const bStep = b.strand === '-' ? -1 : 1
  // Every block of one alignment shares that alignment's strand, so the whole
  // composition has ONE relative orientation and is therefore a single row —
  // there is no chaining or co-linearity check to do.
  const orientation = aStep * bStep

  const ab = alignmentBlocks(a)
  const bb = alignmentBlocks(b)
  const pieces: Piece[] = []
  let aligned = 0
  let i = 0
  let j = 0
  while (i < ab.length && j < bb.length) {
    const x = ab[i]!
    const y = bb[j]!
    const lo = Math.max(x.t, y.t)
    const hi = Math.min(x.t + x.len, y.t + y.len)
    if (hi > lo) {
      const len = hi - lo
      const aFirst = x.q + x.step * (lo - x.t)
      const bFirst = y.q + y.step * (lo - y.t)
      // Put the piece in target-ascending order. With bStep -1 the pivot walk
      // runs down B, so the piece's low B base is at the far end of it and the
      // paired A base moves with it.
      pieces.push(
        bStep === 1
          ? { bLo: bFirst, aAtBLo: aFirst, len }
          : {
              bLo: bFirst - (len - 1),
              aAtBLo: aFirst + x.step * (len - 1),
              len,
            },
      )
      aligned += len
    }
    if (x.t + x.len <= y.t + y.len) {
      i++
    } else {
      j++
    }
  }
  if (aligned < minAligned || pieces.length === 0) {
    return undefined
  }
  // The merge above walks the pivot forward; B runs the other way when its
  // alignment is reverse-strand, so the emitted row's own order is restored here
  // rather than by sorting.
  if (bStep === -1) {
    pieces.reverse()
  }

  const first = pieces[0]!
  const last = pieces[pieces.length - 1]!
  const tstart = first.bLo
  const tend = last.bLo + last.len
  // A runs monotonically against B, so its extremes are the two ends of the walk
  const aFirstBase = first.aAtBLo
  const aLastBase = last.aAtBLo + orientation * (last.len - 1)
  const qstart = Math.min(aFirstBase, aLastBase)
  const qend = Math.max(aFirstBase, aLastBase) + 1

  let cigar = ''
  let blockLen = 0
  let tCur = tstart
  let qCur = aFirstBase
  for (const p of pieces) {
    const dT = p.bLo - tCur
    const dQ = (p.aAtBLo - qCur) * orientation
    // Disjoint, ordered pieces make both non-negative; a negative one would mean
    // the merge produced an out-of-order walk, and emitting it would write a
    // CIGAR whose spans disagree with the coordinate columns.
    if (dT < 0 || dQ < 0) {
      return undefined
    }
    if (dT > 0) {
      cigar += `${dT}D`
      blockLen += dT
    }
    if (dQ > 0) {
      cigar += `${dQ}I`
      blockLen += dQ
    }
    cigar += `${p.len}M`
    blockLen += p.len
    tCur = p.bLo + p.len
    qCur = p.aAtBLo + orientation * p.len
  }

  const identity = a.identity * b.identity
  return {
    qname: a.qname,
    qlen: a.qlen,
    qstart,
    qend,
    strand: orientation === 1 ? '+' : '-',
    tname: b.qname,
    tlen: b.qlen,
    tstart,
    tend,
    numMatches: Math.round(aligned * identity),
    blockLen,
    mappingQual: Math.min(a.mappingQual, b.mappingQual),
    cigar,
    identity,
    tags: [`de:f:${(1 - identity).toFixed(6)}`, `vi:Z:${a.tname}`],
  }
}
