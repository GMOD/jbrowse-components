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
  const cigar = row.cigar ?? ''
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
    // a row that states only its endpoints has nothing to reorient; swapping
    // its coordinate columns is the whole turn-around
    cigar:
      row.cigar === undefined
        ? undefined
        : row.strand === '-'
          ? flipCigar(row.cigar)
          : swapIndelCigar(row.cigar),
  }
}

/**
 * Compose two alignments where at least one states only its endpoints — odgi
 * untangle's projections carry no CIGAR at all, and PIF's coarse tier is the
 * same shape.
 *
 * Such a row is a proportional mapping between its two spans, which need not be
 * equal: an untangle segment covering 4672 bp of CFT073 and 3961 bp of K12 has
 * the intervening indels folded into the endpoints. That is also exactly how
 * such a row draws — one trapezoid — so interpolating across it loses nothing
 * that was ever stated.
 *
 * The result carries no CIGAR either. Neither input had base-level structure, so
 * the composition has none, and synthesizing one (padding the span difference
 * into an indel at one end) would invent a placement the data never gave.
 */
export function composeCoarse({
  a,
  b,
  minAligned = 0,
}: {
  a: PafRow
  b: PafRow
  minAligned?: number
}): PafRow | undefined {
  const lo = Math.max(a.tstart, b.tstart)
  const hi = Math.min(a.tend, b.tend)
  if (hi <= lo) {
    return undefined
  }
  // Where a pivot coordinate lands on one leg's query, interpolated across the
  // whole row. On the `-` strand the query runs down as the pivot runs up.
  const project = (r: PafRow, t: number) => {
    const scale = (r.qend - r.qstart) / (r.tend - r.tstart)
    const d = (t - r.tstart) * scale
    return r.strand === '-' ? r.qend - d : r.qstart + d
  }
  const span = (r: PafRow) => {
    const x = Math.round(project(r, lo))
    const y = Math.round(project(r, hi))
    return x < y ? ([x, y] as const) : ([y, x] as const)
  }
  const [qstart, qend] = span(a)
  const [tstart, tend] = span(b)
  // A projected interval can round to nothing when the overlap is a sliver of a
  // heavily-compressed segment; such a row has no extent to draw.
  if (qend <= qstart || tend <= tstart) {
    return undefined
  }
  const aligned = Math.min(qend - qstart, tend - tstart)
  if (aligned < minAligned) {
    return undefined
  }
  const identity = a.identity * b.identity
  return {
    qname: a.qname,
    qlen: a.qlen,
    qstart,
    qend,
    strand: a.strand === b.strand ? '+' : '-',
    tname: b.qname,
    tlen: b.qlen,
    tstart,
    tend,
    numMatches: Math.round(aligned * identity),
    blockLen: Math.max(qend - qstart, tend - tstart),
    mappingQual: Math.min(a.mappingQual, b.mappingQual),
    cigar: undefined,
    identity,
    tags: [`de:f:${(1 - identity).toFixed(6)}`, `vi:Z:${a.tname}`],
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
 * overlap yields fewer than `minAligned` aligned bases. A leg that states only
 * its endpoints is handled by {@link composeCoarse} instead.
 *
 * The composed row's identity is a LOWER BOUND, not a measurement: no sequence
 * is available here, so it is the product of the two legs' identities, which
 * assumes their divergences from the pivot are independent. Related genomes
 * violate that — they diverge from the pivot at the same sites — so the true
 * identity is higher. Measured on the E. coli demo pangenome by holding out the
 * CFT073-vs-Sakai alignments and composing them back through K12: 1.3 points
 * low on average (0.960 against a measured 0.973), worst case 5.1 points. Enough
 * to shade a ribbon, not enough to move it. Nothing short of the sequences can
 * close that gap, so the row carries a `vi:Z:` tag naming the pivot instead, and
 * is never passed off as a measured alignment.
 *
 * That same hold-out recovered 88% of the real alignment's extent at 99.8%
 * precision — composition can only reach what BOTH legs aligned to the pivot.
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
